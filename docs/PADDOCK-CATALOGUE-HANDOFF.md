# Timing → Paddock: connected catalogue updates

Prepared 1 November 2026 for the Codex instance working on SlotForge Paddock.

## User goal

Timing offers **Local Database / Paddock Database** views. A user browses the host's public cars, selects a car directly for a race, races normally, and finalises results. Timing returns those results through the existing Timing v1 API. Paddock remains the owner of the car and its physical configuration, and distributes accepted results to its connected club copies.

Do not add full database replication to Timing. Do not require Timing to read a Paddock database file or use the private club API. “Public catalogue” here means the existing authenticated public-car projection, not an unauthenticated internet endpoint.

## Implemented in Timing working source

- Local / Paddock views under Database → Slotcars. Linked cached cars are separate from locally managed cars.
- A Local / Paddock browser beside each physical race entry on Home. Selecting a remote car automatically creates or reuses its stable `(databaseId, carId)` link; users do not manually import it. Multi-Class roster restrictions still apply.
- A complete catalogue metadata cache survives restarts. Selected profiles and their original signed captures remain available offline. Credentials remain memory-only.
- One main-process refresh gate shared by all browsers: at most one automatic status check every 30 seconds. The renderer only requests checks while the browser is visible, stops when it is removed, and defers a background view while a modal is open. Main also refuses catalogue network work during racing.
- Unchanged revisions do not download the catalogue. Explicit Refresh now forces a reload. Concurrent checks do not create parallel downloads.
- Network failures back off to 60, 120, 240 and then 300 seconds; HTTP 429 Retry-After can impose a longer wait. No partial catalogue replaces the last complete one. A changed paginated transfer restarts once, then retains the old cache on failure.
- Empty result queues no longer make periodic status requests. Pending results retain the existing independent, durable delivery retry path.
- Renames preserve links. Public specifications and class labels refresh for already-linked cars, while their previously captured configuration stays intact. A newly changed remote class detected at pre-race capture requires refreshing and checking selection rather than silently falling back to the old class. Cars missing from a completed catalogue are marked unavailable for new linked races; history and pending results are retained.
- Existing signed pre-race configuration capture, finalised result delivery, correction, withdrawal and receipt verification remain in use. Catalogue refresh does not replace a pinned race configuration.

The present Paddock API already supports this. No Paddock change is required for basic operation. Timing falls back to `status.revision`, which currently changes for unrelated database activity too.

## Requested Paddock enhancement: a public catalogue revision

Please add an **optional `catalogueRevision` nonnegative safe integer** to both:

1. `GET /v1/status`
2. Every page of `GET /v1/collection`

Example additions (all existing fields remain):

```json
{
  "id": "existing-database-id",
  "revision": 812,
  "catalogueRevision": 47
}
```

Timing working source already recognises this optional field. It uses it only when both the cached collection and the current status provide a valid value. Otherwise it falls back to the existing whole-database revision. Old hosts continue to work; rollback to an old host also works.

### Exact meaning

The value identifies the complete public projection returned by `/v1/collection`, including membership. Persist it with the database and change it whenever that public projection changes:

- Public car added, removed, archived, restored or made visible/invisible.
- Public name, maker, model, marque, scale, race class, technical fields or main picture changes.
- Any other field actually exposed in `publicCar()` changes, including usage if it remains in that projection.
- Approval of a proposal that changes the public projection.

Do not bump it just for a pending/rejected proposal, a private workshop note, authentication state, or a Timing receipt/result **unless that operation changes a field exposed in the public projection**. Use the public projection as the definition, rather than assuming every result or workshop operation is irrelevant. A content digest of the canonical public projection can help detect actual changes; publish an integer counter, not the digest, for this proposed field.

Initialise it for existing databases. Preserve it across normal restarts and update it atomically with the approved mutation. A restored backup can contain an older value; Timing compares for inequality, not “greater than,” and checks database identity separately. Avoid reusing a revision for different public content within the same running database history.

### Pagination and permission requirements

- Keep the existing `revision`, `database`, `offset` and `X-SlotForge-Pages: 1` protocol unchanged. Pagination still validates whole-database revision and returns HTTP 409 for an interrupted snapshot.
- Include one consistent `catalogueRevision` across the accepted collection pages. Do not substitute it for the current pagination revision parameter.
- Preserve Timing credential authentication and `/v1/timing/*` database-header checks. Do not grant private club access.
- Do not expose configuration signatures through the public collection. Selected configurations still come from `/v1/timing/cars/{carId}`.
- Update the v1 handoff/schema/status and collection fixtures to describe the optional field. Do not change `integrationVersion`, the session schema or result revision semantics just for this additive metadata.

## Push feed: deliberately not required now

A 30-second status check is sufficient and keeps idle traffic low. Do not implement a persistent event stream as a dependency of this change. If a public event feed is added later, it needs its own documented capability, authentication, reconnect semantics and coalescing behaviour; Timing must retain the polling fallback. Never direct Timing to `/v1/club/events`.

## Acceptance checks on Paddock

1. Repeated status reads without changes return the same catalogue revision.
2. Save a Timing result that leaves the public car projection unchanged: database revision can change; catalogue revision must stay unchanged.
3. Rename a public car, edit its picture/class/specification, archive it, or restore it: catalogue revision changes and the collection reflects the approved state.
4. Submit an edit proposal: Timing sees the previous approved state. Approve the public change: Timing refreshes on its next check. Reject it: no public revision change.
5. Save private changes with no public projection difference: no catalogue revision change.
6. Restart the host, rotate credentials and change port: database identity and catalogue revision remain valid; ordinary reauthentication still applies.
7. A mutation during pagination must never return mixed pages accepted as a complete snapshot. Exercise Timing's bounded HTTP 409 retry.
8. Existing Timing clients ignoring the new field continue to browse, capture configurations and submit results.
9. Confirm real Timing → dealership host → connected Paddock copies across separate computers: one finalised race reaches the correct car once, with the pre-race configuration; corrections and withdrawals propagate correctly.

## Timing verification and boundaries

Run `npm.cmd run test:paddock` for the client regression suite. For actual Electron checks set `PADDOCK_SOURCE` to Paddock's source folder and run `npm.cmd run test:paddock:catalogue:electron`. The existing `tools/qa/paddock-electron.cjs` also exercises real race crossings, review and HTTP delivery against an isolated Paddock host.

Automated tests cover polling, public-revision fallback, cache persistence, failed pages/commits, concurrent checks, identities, rename/archive and an empty outbox. Actual app checks cover the two database views, direct Home selection, offline selection and eight themes at desktop width plus a 600px layout. These use isolated databases and localhost. They do not establish physical multi-PC dealership replication; that remains a joint acceptance check.

Validation completed on 1 November 2026: full `npm test` passed; all 68 Paddock tests passed with the real local Paddock source enabled; both catalogue UI and existing race/results Electron checks passed. The catalogue UI check also verifies that a remotely reclassified car is filtered out for a driver assigned to another class.

Timing still does not upload Time Token Sessions, old sessions without captures, separate class standings or simulated physical wear. These are existing v1 boundaries, not part of this catalogue change.

Please return an updated handoff/schema/fixtures, the implementing Paddock commit or release, test results, and any difference from the optional field contract above. No Timing credentials or real collection data are needed in the handoff.
