# Paddock result context — phase 2 review

Implemented and reviewed locally on 3 November 2026.

## Delivered behavior

Finalized results now use the existing Timing v1 `adjustments` and `notes` fields:

- Final Race Director time and lap adjustments, including negative corrections.
- Race-system time penalties, with plugin time identified separately.
- Recorded endurance driver-change lap deductions.
- Race Director points adjustments when the saved overall standings actually contain points. Penalty-system points are not mislabeled as championship points; separate class/championship awards remain local.
- Weather, the recorded reason racing ended, recovery counts, and available per-heat weather/end context. Notes identify multi-class and heat-scoring limitations and stay within the 4,000-character contract limit with an explicit truncation notice.

Time amounts are milliseconds. The adjustments explain classification already performed by Timing. They do not alter measured laps, measured mileage, signed car configurations or the receiving application's statistics. Paddock's current contract explicitly says not to apply them again.

The lap journal captures final net time effects during review. It does not sum events, which could include cleared penalties or reset adjustments. Repeating review replaces the snapshot. Across heats, time effects correspond to the elapsed-time total sent by Timing; the notes distinguish those overall totals from the scoring formula used to decide position.

Older journals use the fields they actually contain. Missing sanctions are not guessed from penalty-point counts. Existing delivered payloads are not rewritten or resent automatically; a subsequent supported correction receives the normal higher revision.

## Review findings and repairs

1. Timing always sent an empty adjustments array despite having final reviewed amounts. The converter now populates the documented fields.
2. Summing event logs would resurrect undone changes. The journal records final net effects instead.
3. A single-race saved penalty already contains plugin time. Legacy conversion splits the plugin contribution without counting it twice; new journals retain separate components.
4. For older results without `classifiedTimes`, the elapsed-time fallback previously used the raw total and omitted known adjustments. It now adds exported time effects once. Authoritative captured elapsed totals remain unchanged.
5. Heat sessions did not retain their end reason in the Paddock journal. Review now captures it alongside the per-heat weather summary.
6. Unbounded context could exceed Paddock's notes limit. The converter bounds notes, preserves the important introductory limitations first and marks omitted text explicitly.

## Checks completed

- **105 focused Paddock tests passed**, including eight new result-context tests.
- **318 storage regression tests passed**.
- Both Help checks passed, covering all 111 existing topics.
- Current Paddock production validation/receive code accepted the detailed payload and its duplicate retry. A classification of four laps still produced only the two actually measured laps: 40 metres and 21,000 ms of measured performance in the fixture.
- JSON and SQLite finalization, record-eligibility correction and reopen preserved the adjustments, notes, revision and captures. The SQLite test also compared the original JSON bytes unchanged.
- Engine tests covered cleared/restored penalties, reset adjustments, repeated review and multiple heats. Legacy records, omitted non-exported awards, invalid adjustment values, private-field exclusion and bounded notes were checked.
- Actual Timing/Electron checks verified durable finalization, automatic HTTP delivery of the new fields, the delivered status and receipt check without re-upload. Screenshots were inspected at 1200 px in dark theme and 600 px in light theme; the dialog fit and its controls remained accessible.
- Changed tracked files passed whitespace checks with Windows CRLF accounted for.

Evidence: `outputs/sqlite-conversion/result-context-tests.log`, `result-context-storage.log`, and `delivery-ui/` in the parent workspace. The latter includes the generated reviewed payload and screenshots.

## Scope and safety

The production race timing calculations, database formats, result-delivery protocol and Paddock source were not changed. Tests used artificial collections and isolated profiles. Personal databases were not opened or converted. No GitHub push or release was made.

This phase does not add arbitrary custom fields, maintenance updates, structured class/championship award synchronization or Paddock workshop editing. Paddock's existing v1 receiver can accept these added details without a coordinated API release. A physical two-PC test of this phase was not performed here.
