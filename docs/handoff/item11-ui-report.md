# Item 11: production transition controls and reload continuation

Prepared 2026-10-14 on `claude/wip/item11-vertical-transitions-cloud`, directly after `f1b632e4f915f32956cf9c181a0b89ae558ea412`. Parent explicitly assigned these UI areas while the laptop retained terrain, authoring and integration. This is an isolated integration candidate, not a release.

## Result

- The production DM room-menu action passes the party's previous floor and coordinates to movement dispatch. No-op placement and walking off an arrival no longer count as a fresh entry.
- Spatial markers retain all 346 endpoint choices, including the 48 formerly suppressed by first-marker deduplication. A shared marker offers distinct destinations; the selected button supplies the exact link and endpoint, including same-floor links.
- Players view exposes eligible return routes. Each choice retains its own fog and concealed-object gate; a concealed hatch also rejects automatic traversal until revealed. Hidden choices are excluded from visible text and titles. Route menus close on recompute, view changes, outside pointer actions and Escape.
- Reload restores a valid saved party floor in DM travel mode. Explicit floor requests, first visits, invalid saved floors, camera-only navigation and Player Display retain their respective navigation behavior.
- Directional icons match single destinations; grouped and same-height choices use the neutral stair icon. Route actions take decluttering priority over room labels.

## Exact integration surface

`app/src/main.ts`: previous pose in the room-menu movement handler only.
`app/src/app.ts`: endpoint-preserving marker creation/listeners, route chooser and visibility, concealed traversal gate, saved-floor activation and label priority.
`app/src/core/linkMarkers.ts`: pure endpoint grouping and exact-position hidden-object association.
`app/src/render/build.ts`: optional endpoint metadata on LabelSpec only.
`app/src/styles.css`: removal of the blanket Players-view link-marker hide rule only.
Tests: `tests/link-markers.test.ts`, `e2e/transition-{markers,menu,reload}.spec.ts`, the `takeRoute` helper in `e2e/helpers.ts`, and stronger real-control assertions in `e2e/vertical-links.spec.ts`.
No terrain, authored geometry, generated scene/grid, package version, release or publication changes.

## Verification

Failing-first evidence is retained outside Git at `/workspace/vtt-cloud-evidence`:
- `ui-menu-red.log`: three failures and two passes through the production menu; failures cover no-op placement, departure and phone menu action.
- `ui-reload-red.log`: saved f2 reopens the view on f1. A separate new-test fixture initially assumed Death House had an explicit f1 entry; its actual entry is absent, and that assertion was corrected without relaxing behavior checks.
- `ui-markers-red.log`: baseline cannot expose the shared Players choice through a visible marker.
- `link-markers-red.log`: missing grouping helper; five focused unit tests subsequently pass.

Final build passes. Full unit suite passes with 565 passed, two existing source-cache skips and two existing TODOs, using `--maxWorkers=1` for this cloud's CPU availability; no test timeouts or assertions changed. Focused browser run: 18 passed.

Final complete software browser run: **31 passed, zero failures in 9.0 minutes** across vertical links, marker choices, production menu, reload, movement and Player Display state. The all-direction sweep reports **346 checked, zero wrong levels, zero multiple transitions**. Phone touch and pointer journeys return in Players view after reload without manual floor selection. Four final captures at 1366×768 and 390×844, each DM and Players, were inspected: chooser text is readable and within the viewport; Players sees only the two explored stair choices while DM sees all four grouped choices. Captures and logs remain outside Git in `/workspace/vtt-cloud-evidence/ui-views` and `ui-final-*.log`. Unit duration was 32.57 seconds. These are elapsed test times, not billing metrics.

Two implementation reviews and three final read-only review passes found no remaining source blocker. One review fix corrected the destination icon; the final build includes it.

Final JavaScript bundle: `dist/assets/index-F0YfKBEF.js`, SHA-256 `9c3ce5013cd2fd7970f0c750223ec72a29a2c52038a6e95a08fa3f86ff0b3d99`.

## Limits and handoff

Chromium 154 uses the preinstalled system executable with SwiftShader. This is software browser verification, not hardware GPU verification. The previously denied browser download was not retried or bypassed. There is no `/dev/dri` here. Laptop GPU, integrated CI, release and publication remain pending.

The all-346-direction dispatch sweep verifies endpoint dispatch, not walking approach or actionability across every map. Six authored landing defects and broader all-map terrain/placement defects remain laptop-owned; see `item11-followup-report.md` for the full proposals and the 48-endpoint inventory. Production menu tests invoke the real room-menu handler with a room hit and click/tap its rendered action; they do not certify canvas hit testing for every room.

Remote refs verified before commit: default `785421cb45ad3b7a5467a14f6e696074efb9bd27`; published laptop WIP `1c8d94a26764eeafc91a12db234976f2b8f9bb7f`. Parent-reported laptop local `b65d78953c49d03639b31cf47bf91bfaf3bd8ed3` could not be fetched (`not our ref`); no laptop history was merged or rewritten. Integrator must reconcile these exact assigned UI regions with the newer laptop checkout.
