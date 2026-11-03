# Paddock specifications — phase 3 review

Implemented and reviewed locally on 3 November 2026.

## Delivered behavior

Opening a linked Slotcar now displays its saved public Paddock specifications in seven collapsible, subtly coloured groups: body/chassis, motor/performance, gearing, front axle/tyres, rear axle/tyres, guide/electrics and weight/setup. All 49 public technical fields in the current Timing v1 contract are covered. Empty fields and groups are omitted.

Installed components show their name, quantity, recognised field and position, with 50 entries per page. The saved capture date is explicitly distinguished from live connection status. The view works offline from the existing captured configuration and does not request additional data.

The edit form includes the same section, initially collapsed, inside its scrollable content. The linked-car view labels its edit action **Edit Timing settings**. Paddock specifications remain read-only; local simulation settings and service history retain their existing behavior. Help explains ownership, refresh and offline use.

## Review findings and repairs

- Putting expandable specifications outside the edit form's scrolling region would squeeze local controls and the Save button. They now share the form's scrollable area, with Save/Cancel accessible at 600 px.
- Component navigation uses explicit non-submit buttons and scoped handlers. Paging does not close or save the form and does not fetch the catalogue.
- Public text is escaped and kept separate from markup. Unknown/private technical fields and internal component identifiers are not exposed. Prototype-property names cannot become field labels.
- Missing configurations, mismatched link identities, invalid dates and empty specifications have explicit states. Invalid component quantities and blank names are excluded.
- The renderer does not normalize or mutate the signed configuration. Existing JSON and SQLite ownership protections prevent local edits from overwriting Paddock fields.
- The initial Help addition exceeded its wording cap. The topic was tightened without removing its refresh, offline, ownership or race-capture guidance.

## Validation

- **112 Paddock tests passed**, including seven new specifications tests. The seven were rerun after final identity/component hardening, with no failures or skips.
- **318 storage regression tests passed**.
- Existing screen tests, package tests and both Help checks passed; all 111 Help topics remain available.
- The public-field coverage test compared the renderer against Paddock's current local `src/timing-schema.cjs` contract.
- JSON and SQLite tests linked a rich synthetic profile, attempted a forbidden signed-profile overwrite alongside an allowed local edit, reopened storage offline and verified exact configuration preservation. The SQLite test also verified the original JSON bytes remained unchanged.
- Actual Timing/Electron checks used a generated profile and a localhost test host. They exercised offline viewing, component pagination, a collapsed editor section, protected fields and a local edit through the production API.
- Screenshots and fit checks covered all nine theme selections at 1200 px and the light theme at 600 px. The narrow view and expanded editor were inspected; controls remained reachable without horizontal overflow. No renderer errors were recorded.
- Changed tracked files passed whitespace checks with Windows CRLF accounted for.

Evidence is in the parent workspace: `outputs/sqlite-conversion/specs-*.log` and `outputs/paddock-specs/` (screenshots and `results.json`). Reusable app checks are `tools/qa/run-paddock-specs.cjs` and its Electron harness.

## Scope and safety

Personal databases were not opened, converted or modified. All tests used generated profiles. Paddock source, storage schemas, race calculations, delivery protocol and saved race captures were unchanged by this phase. No push or release was made.

This exposes the existing public contract, not arbitrary private/custom Paddock fields or workshop editing. It adds no new network synchronization. Real two-PC testing was not performed for this phase; the UI and storage integration were verified locally.
