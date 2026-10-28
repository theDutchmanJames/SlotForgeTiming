# 1.85.1 validation — Visible red-flag protection

Date: 26 October 2026.

## Behaviour

Race Setup > Start makes the automatic protection and optional result-time addition unambiguous. A red-flag-interrupted lap is still handled by the existing engine rule: it remains distance/order, is invalid, and cannot become a Personal Best or Track Record.

The Final Check now displays a red interruption notice on the affected driver's card and adds the count to its Review laps control. The detailed lap list continues to identify every protected lap as a red-flag interrupted lap. The patch does not change timing, hardware, stored results, database data or migrations.

## Automated checks

- `node tests/resultsview.test.js`: passed. Includes a real red-flag interruption sequence and verifies the Final Check notice and protected-lap count.
- `node tests/raceupdates.test.js`: passed (9 groups), including protected-lap, result-time, persistence and repeat-red-flag behaviour.
- `node tests/screens.test.js`: passed, preserving the setup screen structure and renderer loading.

## Limits

No physical timing hardware or real-app visual pass was repeated for this small UI/guidance patch. The user performs the actual-app review before release as agreed.
