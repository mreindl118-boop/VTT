# Movement blocker endpoint correction

2026-10-14, item 2e, integration base `37ae2ffc9b1638919fe493ff6a8397552f2e36c5`.
Initial implementation completed two independent reviews. Both passed; no review fix pass was needed or used.

## Reproduction and cause

The landing-authoring lane added the Abbey's actual rendered road/ledge polygons to its walkable floor. The existing gate remains at `[150,130]` to `[157.5,137.5]`. With that legitimate floor, `canWalk` incorrectly connects the two sides of the closed gate; a strict geometric route probe by the authoring lane finds no route.

Movement reused `segmentsIntersect`, whose documented sight-ray semantics intentionally exclude contacts at the ray origin and destination. A diagonal blocker can pass through a 2.5-foot movement-lattice node. Routes could step onto that node and then off the other side. Collinear travel along a blocker was also accepted. The old lattice comment only held for axis-aligned five-foot wall lines.

The new focused test ran before the implementation change: **five failed, three passed**. Its failures cover the diagonal wall, closed locked diagonal gate, destination on a blocker, collinear travel and actual Abbey gate. Existing assertions were not changed.

## Change

Only `app/src/core/movement.ts` changes production behavior. Movement adds endpoint-contact and collinear-overlap checks after its ordinary intersection check; a bounding-box rejection keeps distant blockers inexpensive. The contact tolerance is one billionth of a foot, for numerical contact rather than creature clearance.

`geometry.ts` and sight-ray behavior remain unchanged. `moveBlockers` still decides which walls/doors block, including existing open-door, locked, window, ethereal and unrevealed-secret semantics. No generated map, wall identity, saved-state field, UI, renderer or transition method is changed by this lane. A nonzero move from or to a closed blocker is rejected; the existing zero-distance no-op remains unchanged. A saved/DM-placed token exactly on a closed wall requires the ordinary DM repositioning/open-door path rather than an ambiguous automatic choice of side.

## Verification

- New endpoint checks plus existing movement and unchanged landing checks: **29 passed**, zero failures.
- Expanded focused run: **eight files, 112 passed**, zero failures. Files: `movement-blocker-endpoints`, `movement`, `landing-geometry`, `vallaki-apertures`, `wsc-walkable`, `vertical-links`, `vision`, `range`.
- The first expanded run encountered missing sandbox temporary transformed-module files: six suites did not load; 47 tests in the other two files passed. The identical command outside that sandbox completed the 112-test result above. This was an environment retry, with no test or implementation adjustment.
- The actual Abbey gate rejects both directions while closed and permits both directions while open. Synthetic coverage also keeps an open diagonal aperture, movement beside a wall and movement around a free wall end usable. The sight-origin contact assertion remains unchanged in meaning and passes.
- A read-only geometry scan found zero closed-blocker contacts for all 22 authored spawn objects and all 45 scenes' default snapped party positions, calculated with the existing `ensureDefaultToken` selection and five-foot grid convention. This only checks exact wall contact at fresh-entry positions, not complete traversal or arbitrary existing saves.

## Independent reviews

Root confirmed both independent reviews passed on the unchanged movement implementation:

- Correctness: 659 adversarial assertions; the baseline leaked across 39 of 108 closed-barrier cases, reduced to zero with this correction.
- Regression/compatibility: 115 related tests passed; 346 transition arrival positions and 44 production fresh-entry candidates had no blocker contacts.

No additional implementation correction or test weakening followed the reviews. The broader counts reflect the reviewers' current integrated fixtures, separate from this lane's earlier 112-test checkpoint.

No full build, full unit suite, browser/GPU run, commit or release was performed by this lane. Root owns those integration gates and the shared status/queue records. Desktop/phone DM/Players traversal and cost verification remain integration work.
