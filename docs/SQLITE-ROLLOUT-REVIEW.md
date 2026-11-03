# SQLite default and conversion prompt review

3 November 2026. Local implementation; personal profile not opened or converted.

## Behaviour

- Fresh installations create a SQLite generation automatically. Default data is seeded inside an unpublished generation, converted using the existing verified-copy pipeline, and selected only after validation. No active JSON database is created in the profile root.
- Existing JSON users see a native startup prompt: **Convert and continue**, **Remind me in a week**, or **Keep using JSON**. Closing the prompt postpones it. Preferences are stored separately from the JSON database. Manual conversion in General settings remains available after either postponement choice.
- Conversion retains original database/settings/recovery files. Future writes go only to SQLite. The prompt explains disk-space needs, possible conversion time and downgrade limitations.
- Interrupted first installations retry from their durable request. They cannot offer to reopen a nonexistent previous database. Existing conversion/restore cancellation remains available.
- Storage selection and old-name profile migration now happen under the single-instance lock. Old-name migration errors are surfaced; the main file is published after sidecars, never before them.

## Review findings repaired

1. A missing JSON file could otherwise be mistaken for a fresh profile. Database, settings, recovery, SQLite and conversion-preference traces now prevent empty replacement.
2. A JSON `null` storage marker could look like an absent marker and permit fallback. Storage metadata must now be a non-null object. Malformed prompt preferences instead ask again, without implicit conversion.
3. First-install interruption needed its own durable request, isolated seed and recovery behaviour. Added these without changing legacy conversion/restore contracts.
4. Fresh installations have no pre-conversion JSON files. General settings wording now says **any** retained files rather than claiming all users have them.
5. Storage Help exceeded the readability limit. Split conversion, backups/recovery and performance into three searchable topics; retained every existing topic.

## Verification

- 318 storage tests passed on Windows, including 21 new rollout regressions.
- Forced process exits at six initialization checkpoints recover correctly; selected generations survive reopening and original JSON bytes remain unchanged through conversion and later SQLite edits.
- Actual Electron: fresh startup, reopen, remind/deferred startup, keep/deferred startup, conversion and converted reopen passed on generated profiles. Settings screenshots captured and inspected.
- Actual Electron: existing manual activation, abrupt race exit, recovery/finalization, JSON restore and native restore passed.
- Packaging/legacy-folder migration tests and Help content/navigation checks passed (111 topics).
- Native Windows, Linux and Intel macOS qualification all passed: 318 storage tests per OS, bounded volume/native-backup checks, first-launch/conversion choices, full app recovery/restore/reopen, and packaged ASAR worker checks. [Run 41661565396](https://github.com/theDutchmanJames/SlotForgeTiming/actions/runs/41661565396), test-branch snapshot `2a5e57d046ff7303eeb90900a4e23580f2451e7c`.
- Existing renderer screens, JSON database operations and asynchronous shutdown tests passed. Actual JSON Home and race preparation passed across all nine themes after postponing conversion.

Evidence is under `../outputs/sqlite-conversion/rollout-*.log`, `rollout-ui/` and `activation-ui/`. All profiles and race records were generated for testing. No release or personal database conversion was performed.

Physical power loss and user-specific disk/security software remain outside simulated exit and I/O-failure coverage. Conversion retains recovery copies and requires sufficient disk space.
