# SlotForge Paddock integration

Timing uses Paddock's Timing v1 API, available from Paddock 0.17.0. Paddock 0.18.0 is the tested release and includes custom passwords and Timing car exports. Its internal database schema 10 does not change Timing's API or database.

## Connect and race

1. Start sharing in Paddock and enable **Allow Timing results**.
2. In Timing, open **Database → Slotcars → Connect to Paddock**.
3. Find the host on the network, or enter the IPv4 address and port displayed by Paddock. Enter its separate **Timing connection code or password**.
4. Switch to **Paddock Database** to browse public cars. Local cars remain under **Local Database**. On Home, **Browse Local / Paddock cars** selects a remote car directly and caches it automatically. The connection dialog retains optional tools to link an existing local car and preserve its history.
5. Finalize reviewed race results to queue delivery. Previously selected cars with valid captures remain usable offline.

While the Paddock browser is visible, a shared 30-second revision check refreshes only changed catalogues. Explicit Refresh now forces a reload. Failed checks back off to five minutes (or a longer authentication cooldown). Full pagination must succeed before a cache is replaced. Polling stops during racing; empty outboxes cause no network requests. An optional public `catalogueRevision` is supported, with fallback to the existing database revision. See [the Paddock handoff](PADDOCK-CATALOGUE-HANDOFF.md) for the proposed host-side addition.

Codes and passwords are held in memory, not saved in the database. Custom passwords require Paddock 0.18.0 or later and use 8–128 printable ASCII characters; preserve case and repeated internal spaces, with no spaces at either end. Generated codes remain supported. Restarting Paddock sharing resets custom passwords. Reconnect after restarting Timing or Paddock sharing; Paddock's code and port can change. A host's stable database identity prevents accidental delivery to another collection.

## Data ownership

Paddock owns the linked car's catalogue specifications, picture and Race Class. **Refresh linked cars** updates those fields. Timing keeps its own simulation factors and service settings. Refresh does not replace local car IDs or erase Timing's race history. Archived or deleted Paddock cars are blocked from starting a new linked race once that change is known.

Before racing, Timing captures Paddock's signed current configuration. Offline racing uses the last cached configuration and displays its capture date. The result retains that exact configuration even if Paddock's car is modified later. Historical results are never silently reassigned to today's setup.

## Result delivery

The session and outgoing result are saved together in Timing's database. Background delivery waits until racing is inactive. Network failure leaves a durable queue; **Result delivery** shows delivery status and offers retry. The receiver's matching identity, revision, state and content hash are checked before acknowledging a result. Repeated delivery does not add duplicate mileage or wins.

Record exclusions create a higher revision. Deleting a session queues a withdrawal; deleting related recorded laps, cars, drivers or tracks also withdraws the affected uploaded session rather than leaving misleading partial statistics. Validation problems remain visible as **Needs attention** and do not prevent local result storage.

The journal stores measured sensor completion times, independent of the paused race clock. Driver swaps retain their actual boundary, and heat rotation retains each lane and its length. Configuration snapshots and journals survive race checkpoints. Durations are sent as whole milliseconds; unknown lane distance stays unknown.

## v1 boundaries

- Current Paddock configuration only; selecting another saved Paddock setup is not supported by this API.
- Overall classification is delivered. Separate Multi-Class standings and awards remain in Timing.
- Time Token Sessions, old sessions without captures, and manually inserted laps without measured completion timestamps are not uploaded.
- Virtual rivals never contribute physical mileage. Simulated fuel, wear and damage do not edit Paddock workshop records.
- Ordinary sharing exports/imports remove host links, configuration journals and outgoing queues. Full database backups preserve them. Restoring an old backup cannot bypass Paddock's revision checks.
- Paddock enforces its v1 limits, including an 8 MiB session payload. Rejected results remain local with an explanation.

## Verification

From the Timing source folder in PowerShell:

```powershell
npm.cmd run test:paddock
$env:PADDOCK_SOURCE = 'C:\path\to\updated\SlotForge Paddock source'
npm.cmd run test:paddock
& '.\node_modules\.bin\electron.cmd' tools/qa/paddock-electron.cjs
npm.cmd test
```

Without `PADDOCK_SOURCE`, the tests that require the real Paddock host or discovery listener are skipped. With it, the tests start an isolated host with artificial cars, verify offline delivery, historical configuration retention, corrections, withdrawals, endurance swaps and lane rotation. The audit suite also covers a connection dropping after the host commits a result, persistence failures, reviewed lap deletion, fractional clocks, cached offline starts and checkpoint recovery. The Electron harness uses a separate disposable profile, exercises the real Timing interface and race flow, and captures all eight themes plus a 600px layout. It does not use the normal user's collection.

User acceptance on two Windows PCs confirmed connection over the local network. Automatic discovery initially returned no host, then succeeded after waiting or repeated clicks. The revised scanner retries automatically for about four seconds, uses a separate socket for each local adapter, and tries subnet broadcast alongside multicast. The revised discovery behaviour still needs confirmation on those two PCs; reconnection and result delivery on that physical network remain separate checks.

If discovery finds no host, confirm sharing is active in Paddock. Discovery uses UDP port 47778 and multicast group 239.255.47.77; the actual database connection uses a separate TCP port displayed by Paddock. A working connection by address does not prove that discovery packets are allowed. Timing now distinguishes inability to send discovery requests from a completed scan with no replies. Entering the displayed address and Timing code remains available.

## Connection cooldown and file imports

After repeated incorrect credentials, Paddock returns HTTP 429. Timing respects its Retry-After delay (or waits one minute when missing/invalid), shows a countdown and blocks requests to that host during the cooldown, including manual retries. Pending results are retained. Changing the port or reopening the connection dialog does not bypass the wait. Credentials and cooldowns are memory-only.

For independent copies, export selected cars from updated Paddock using **SlotForge Timing**, then open **App Settings → Import and Export → Import**. Supported car specifications, race classes and photographs are imported through the existing importer. Each import creates new IDs, including repeated imports; it neither updates linked cars nor creates a live link. Paddock saved setups, private records and performance history are not transferred. Use **Connect to Paddock** when results should return to the original car.

## Delivered-result warnings

In **Result delivery**, use **Check Paddock result** beside a delivered session to retrieve its latest receipt. This is a read-only host request; it never resends, revises or withdraws a result. Checks run on demand outside an active race. **Refresh local status** only redraws Timing's saved status.

**Delivered · correction needed** means Paddock reports overlapping measured lap intervals and excludes the session from statistics. Review/correct its saved lap data, or deliberately delete the session to queue a withdrawal. Retrying unchanged results cannot repair it. An archived-car warning means the historical result was accepted for a car archived in Paddock.

Receipts must match database, source, session, revision, state and payload hash. A missing or different host receipt is reported for investigation; Timing never overwrites local results or silently resubmits them. Failed checks preserve the last saved receipt. Corrections or deletions made while a check is in progress take precedence.

## Bundled reference provenance

The upstream handoff under tests/fixtures/paddock is copied unchanged from Paddock **v0.18.0**, commit **e062e62b51120e1954a0258290fc7e787ff9922e**. Release ZIP SHA-256: **cf2b06c33ee4e390adc8ef6ca9d2d1fc6b2abc6f7fc62eca3f18e88197dafc82**. Its README/TESTING files contain historical statements that the Timing client is pending and that passwords require source builds; those describe the upstream handoff's earlier validation, not Timing's current implementation. This guide records Timing's current behaviour.
