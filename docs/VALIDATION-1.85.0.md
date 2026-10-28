# 1.85.0 validation — Race Results flow and curved lane stripes

Date: 26 October 2026.

## Behaviour

The main Race screen presents a dedicated Director's Final Check page while its phase is `review`. It uses the existing review commands, so invalidating/removing laps, disqualifying/reinstating drivers, result adjustments, pending penalty decisions, sector placement, finalization and discard continue to change the same race engine state as before. A red-flag-interrupted lap remains protected by the existing rule and cannot be marked valid.

The Live Race second screen opens Race Results automatically once per heat/race when it reaches review or finished. It reads the shared engine state and therefore shows the same standings and legal-lap state. The configurable view affects display only: four selected figures, a comparison bar and optional winner emphasis. It changes neither results nor saved data.

Side Stripe now uses a rounded inherited border edge, so its top and bottom follow the widget/card corners. Full Widget and Top Stripe behaviour are unchanged.

## Automated checks

- `npm run test:results`: passed. Covers settings cleaning, card count, winner/stripe markup, metrics and the new Final Check renderer.
- `tests/lanestyle.test.js`: passed (14 groups), including the rounded side-stripe CSS assertion and existing rendering/serialization coverage.
- `tests/adjust.test.js`: passed, preserving adjustment and championship-result semantics.
- `tests/raceupdates.test.js`: passed (9 groups), preserving red-flag integrity, live systems, championship skips and tyre behaviour.
- JavaScript syntax checks passed for the changed renderer files.
- `npm run test:results:electron`: passed with isolated app data; opens a production race, verifies the main Final Check, second-screen Results Wall and the Customization settings page.
- `npm run test:lane-style:electron`: passed after updating its computed-style assertion for the rounded side-border stripe.

`npm test` now runs the new results check through its `pretest` hook before the established long sequential suite. The full unattended suite and real-app visual pass should be repeated in the release build environment.

## Limits

No physical timing hardware, phone or second physical display was tested. The user performs the actual-app review for each release as agreed. No database migration or dependency was added.
