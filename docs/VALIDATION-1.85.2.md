# 1.85.2 validation — Results on Timing and balanced cards

Date: 26 October 2026.

## Behaviour

Live Race > Race timing continues to show the live widget layout while a race runs. At Final Check or after finalization, it changes to the same configured Race Results wall as the dedicated Results tile. The wall remains until a new race starts, then the live widget canvas is rebuilt. The dedicated Results tile remains available.

For one to four drivers the wall has an explicit compact grid class: four cards are 2 × 2, three use two cards plus a full-width card, and two use two columns whose cards each span both rows. Five to eight drivers keep the existing four-column presentation.

## Automated checks

- `npm run test:results`: passed. Verifies both four- and two-driver result-wall classes.
- `npm run test:results:electron`: passed. Runs a production Electron race into review, verifies the dedicated second-screen wall, then verifies that the normal Timing page shows result cards (not the live widget canvas).
- `node tests/livegrid.test.js`: passed.
- The long `tests/live.test.js` reached the updated Live Race tile assertions successfully. It still ends with three unrelated existing review-adjustment assertion failures; they are not in the changed Timing/results path.

## Limits

No physical timing hardware or manual real-display review was repeated for this display-only change.
