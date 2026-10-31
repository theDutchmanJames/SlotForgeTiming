# SlotForge Paddock integration

Timing uses Paddock's Timing v1 API. Use the updated Paddock source supplied with the integration handoff; the previously shipped Paddock v0.16.3 executable does not expose this API.

## Connect and race

1. Start sharing in Paddock and enable **Allow Timing results**.
2. In Timing, open **Database → Slotcars → Connect to Paddock**.
3. Find the host on the network, or enter the IPv4 address and port displayed by Paddock. Enter its separate **Timing connection code**.
4. Load the catalogue. Choose **Use this car**, either creating a new Timing car or linking an existing car to preserve its local history.
5. Select the linked car normally when starting a race. Finalize the reviewed race results to queue delivery.

Codes are held in memory, not saved in the database. Reconnect after restarting Timing or Paddock sharing; Paddock's code and port can change. A host's stable database identity prevents accidental delivery to another collection.

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

Without `PADDOCK_SOURCE`, the four tests that require the real Paddock host or discovery listener are skipped. With it, the tests start an isolated host with artificial cars, verify offline delivery, historical configuration retention, corrections, withdrawals, endurance swaps and lane rotation. The audit suite also covers a connection dropping after the host commits a result, persistence failures, reviewed lap deletion, fractional clocks, cached offline starts and checkpoint recovery. The Electron harness uses a separate disposable profile, exercises the real Timing interface and race flow, and captures all eight themes plus a 600px layout. It does not use the normal user's collection.

User acceptance on two Windows PCs confirmed connection over the local network. Automatic discovery initially returned no host, then succeeded after waiting or repeated clicks. The revised scanner retries automatically for about four seconds, uses a separate socket for each local adapter, and tries subnet broadcast alongside multicast. The revised discovery behaviour still needs confirmation on those two PCs; reconnection and result delivery on that physical network remain separate checks.

If discovery finds no host, confirm sharing is active in Paddock. Discovery uses UDP port 47778 and multicast group 239.255.47.77; the actual database connection uses a separate TCP port displayed by Paddock. A working connection by address does not prove that discovery packets are allowed. Timing now distinguishes inability to send discovery requests from a completed scan with no replies. Entering the displayed address and Timing code remains available.
