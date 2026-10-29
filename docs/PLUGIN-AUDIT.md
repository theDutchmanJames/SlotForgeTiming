# Plugin implementation audit — 29 October 2026

Scope: Content Packs; executable package installation, storage, supervision and IPC; timing interfaces; display widgets, pages and tools; frozen race rules, recovery, scoring and viewers. Local version remains 1.99.2.

## Findings repaired

| Area | Finding | Repair and regression evidence |
| --- | --- | --- |
| Required-rule recovery | A rejected engine ledger could leave a fresh ready race visible instead of blocking recovery. | Return to Home, detach race controls and preserve the original checkpoint. Real Electron test corrupts the ledger, verifies the block and compares the saved checkpoint before/after. |
| Package integrity | Package files and digest were verified, but registry manifest metadata was not compared with the package manifest. | Bind normalized registry metadata to the verified package and validate its settings. Regression alters the registry name while keeping the original package and digest. This is an integrity check, not a sandbox for trusted Node code. |
| Tool controls | Refresh could unlock a pending tool. Blank numeric fields became zero; returning to the same page could receive an obsolete result. | Keep a pending lock, preserve blank inputs as invalid, track page revisions, clear old output and display progress. Regression covers repeated clicks, page replacement, errors and race locks. Electron runs a deliberately delayed tool. |
| Display lap history | The last 100 lap samples had absolute invalid-lap indices but no explicit starting index. Scoring adjustments made the origin impossible to infer reliably from the lap-count value. | Add `lapStartIndex`, retain absolute indices within the supplied window and reject fractional/out-of-range indices. Older API 1 snapshots without the new optional field remain accepted. |
| Timing continuity | A missing sequence number could be accepted as a normal sensor event, potentially hiding a lost crossing or release. | Disconnect on sequence gaps, retain race ownership and require recovery. Duplicate/stale rejection remains intact. Tests also cover startup events already represented by the baseline snapshot. |
| Content Pack rollback | A corrupted library could associate a previous version with a different Pack ID. | Reject the library's mismatched rollback identity before mutation. Existing library backups and database isolation remain available. |
| Native heat results | Disqualifying a heat without a rule plugin could introduce a zero-valued `pluginPoints` field. | Preserve absence of plugin metadata for ordinary races; zero the field only when it already exists. |
| Long-race rule calculations | Finding the latest 100 eligible laps copied and filtered the entire lap history on every crossing. | Scan backwards until 100 eligible samples are found, then sort only those samples. Tests compare eligibility/statistics and verify only 100 lap-value reads for a clean 100,000-lap history. Long invalid stretches can still require scanning further back. |
| Guidance and QA drift | Content Pack guidance and API documents still described completed plugin stages as planned. An older Electron check expected that obsolete wording. | Update app guidance, public API docs and the UI check to describe the available runtime, timing, display and rule APIs accurately. |

## Verification

- Full `npm test`: **196 commands passed** (54 pretest + 142 test).
- New `tests/pluginaudit.test.js`: seven regression groups covering integrity, rollback, data indexing, native heat metadata, tool interactions, timing continuity and long histories. Rule tests were rerun after the final performance change.
- Actual Electron: plugin-manager installation, activation, generated settings, commands, updates, rollback, crash handling and removal; separate startup with `--disable-plugins`.
- Actual Electron: Content Pack import, copy, theme application, update, rollback, export, create and remove; imported layouts render in the existing editor.
- Actual Electron: simulated timing interface, shared race inputs, faults and explicit recovery; no physical hardware used.
- Actual Electron: plugin widgets/pages/tools, delayed-tool locking, blank input validation, second Electron display and HTTP viewer.
- Actual Electron: rule preparation, Race Setup persistence, raw versus adjusted time, lap review, saved results, checkpoint provenance, corrupted recovery and missing/stopped dependencies.
- Theme checks: dark, light, midnight, forest, sunset, violet, carbon and ocean. Narrow 600 px and desktop 1280/1440 px captures, depending on the page. Display screenshots inspected across all eight themes.
- Packaged-worker check: an ASAR worker loads separately installed plugins and exercises background commands, timing, displays and frozen rule preparation.
- Whitespace check passed. Existing widgets, layouts and native race regression coverage remain in the full suite.

The first Content Pack Electron run exposed obsolete test wording rather than a failed import. Its expectation and the stale in-app guidance were corrected, and the complete workflow passed. The recovery QA also waits for the previous race's asynchronous final save to finish before creating its deliberately corrupted recovery fixture.

## Boundaries

No unresolved reproduced defect remains from this audit. This is not a guarantee against all possible faults. Real timing devices, drivers and physical output failsafes remain unverified. Plugins execute trusted Node code with operating-system access; worker isolation does not sandbox malicious plugins. API 1 still deliberately limits display contributions to app-rendered blocks and race rules to bounded frozen programs.

Human-readable review and screenshots: `../outputs/plugin-audit/review.html` in the surrounding workspace. Test logs are in that workspace's `outputs/plugin-audit-*.log` files. No release or GitHub push was performed for this audit.
