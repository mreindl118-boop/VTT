# All-map logic audit checkpoint

Baseline `785421cb45ad3b7a5467a14f6e696074efb9bd27`; current implementation `f18f087486f39dc4acb8de4199c43776fbef9fe5`. Inventory is complete. Every scene now has a declared source or authored-reference comparison and bounded runtime evidence; full source/render/traversal sign-off remains open; findings are not equivalent to permission to fix every map in 0.3.1.

## Coverage

| Check | Coverage | Result / limit |
|---|---:|---|
| Production inventory | 46 maps | Two regions, 44 scenes, 122 levels |
| Development fixture | One scene, two levels | Separate from production coverage |
| Scene schema | 45/45 | Pass; does not prove geography or gameplay |
| Rigid placement assertions | 120/120 | Pass; does not prove canonical scale or adjacency |
| Polygon validity | 45/45 scenes | 25 invalid polygons across eight maps; impact requires triage |
| Outdoor heuristics | 45/45 scenes | 412 flags across eight maps; many need interpretation |
| Chapter 2 narrative | 13 maps / 34 levels | 47 comparisons; source plan checks added for G/T/region separately |
| Five-map plan + narrative structure | Five maps / 31 levels | 45 comparisons; 13 primary plan pages inspected, Castle partial |
| Sheep Chase authored reference | Six maps / nine levels | 15 comparisons; original publisher map review blocked |
| Remaining Strahd source | 21 scenes / 48 levels | 48 comparisons; 18 primary map pages and all 48 CPU level diagrams inspected |
| Desktop DM overview | 44 scenes / 122 levels | Captured and visually triaged; bounded first pass |
| Final settled site repeats | 42 views | Desktop/phone, DM/Players for selected sites; local-only evidence |
| Initial Players movement | 44/44 scenes | 42 pass; Abbey and Sheep Chase square fail six short candidate moves |
| Desktop wheel both directions | 44/44 scenes | Responds in both directions; not every nested journey |
| Door aperture CPU probe | 365 doors / 122 levels | 290 open passes, 28 blocked, 47 not probed; 25 blocked apertures overlap another normal wall |
| Final phone DM/Players scene views | 44/44 scenes, 92 images | All inspected locally, following movement probes, with four fresh child Players entries after parent selection |
| Final phone movement/zoom | 44/44 scenes | Movement 42 pass/2 fail; zoom responds both ways in all 44; zero page errors |
| Snapped vertical-link arrivals | 173 links / 346 endpoints | 335 nearby moves pass, ten blocked, one oversized lattice excluded; 20 arrivals >0.5 ft outside floor |
| Isolated exact link methods | 346 activations | 290 reach requested level; 56 wrong level, 22 multiple transitions; unchanged baseline behavior |
| Region view and zoom | Two regions / eight device-view combinations | 16 images inspected; zoom responds both ways in all eight, zero page errors |
| Castle baseline comparison | Eight images | Ground and dungeon, desktop/phone DM/Players; dungeon burial reproduces on 0.3.0 |
| Full criterion sign-off | Open | Source, visual and traversal evidence must be reconciled per map |

Curse of Strahd has 39 scenes/113 levels plus its region. All 39 scenes have source comparison evidence (140 recorded relationships across three batches), and its regional plan was inspected. Sheep Chase has five scenes/nine levels plus its region. `ch02/encounter-terrain` is a manifest-only terrain-kit entry, with no scene or world file; it is recorded but excluded from available-map totals.

## Findings that affect continuity

- **Regional terrain:** current Tsolenka approach fragments reach 167%/159% grade; Luna height samples rise and fall by thousands of feet. H/G/D water datums rise downstream. Local bridge/road ties do not repair those regional height relationships. Sheep Chase also has a stream that rises and falls on the sampled raw heightfield.
- **Entrance placement:** J and K are separated by 4,598 ft horizontally and about 584 ft vertically despite a contiguous entrance relationship. Sheep Chase places the tavern and its adjacent street at separate root pins exactly 5,280 ft apart. R has unfinished route continuations.
- **Source geometry:** the five-map report confirms displaced Death House dungeon links, Castle ladder/stair/width discrepancies, X9's 2-ft rather than 20-ft descent, invalid X catacomb polygons, flattened Q external stairs and T's uncovered upper stair landing. Source conflicts are retained as constraints; the 70-ft T deck plus two 10-ft arch passages supports the 90-ft overall bridge description.
- **Source interpretation:** Amber's halls extend into a mountain. Their footprints outside the apron are intentional; an excavation/rendering treatment is not proof that an open-air temple is canonical. Sheep Chase's current 40-ft stone tower is a documented earlier replacement for offset treehouse platforms, so its provenance and stale regional description require an explicit interpretation decision.
- **Visible terrain:** settled final-build repeats confirm N9 camp burial and H terrain filling the canyon. Castle's dungeon is obscured by regional terrain on both the final phone build and frozen 0.3.0; eight baseline desktop/phone DM/Players images establish that it is an existing issue. Its fresh default entry is ground; the initial movement probe had traversed to the dungeon before the candidate screenshots. N6 weak wall silhouettes persist, but their relationship to the section cut remains unresolved. L surface mismatch, M rectangular boundary, P water joins, Y terrain and the mill attic remain tracked with limits.
- **Players movement:** Abbey and Sheep Chase square reject every attempted short move from the initial entry. These agree with queued movement findings; door logic is preserved. The CPU aperture probe has 28 blocked cases in Castle, E5, N2, N3, N4 and N6. Geometry confirms 25 open apertures overlap another normal blocking wall by 2.5 to 5.5227 ft. Three Castle cases cross non-collinear walls and still need interpretation; not every alternative route or door UI event was tested.

- **Vertical links:** snapped arrival probes block at ten endpoints, including T upper landing, E5 undercroft and S10 road entry. Twenty arrivals lie over 0.5 ft beyond their floor polygons; shaft/lift voids need source interpretation. Executing the exact committed `takeLink`/`afterPartyMove` methods in isolation reproduces 56 wrong destination levels and 22 multiple transitions out of 346 activations. These methods and all 44 scene link arrays are unchanged from baseline; the multiple-hop issue is already queued under item 11.

- **Remaining source batch:** the Vallaki source comparison identifies oversized rooms and displaced upper-room keys/hatches, an undersized N6 roof, N8 civic-layout changes, and the flattened N9 hill. O stair placement, V/W invalid opening polygons, Y's documented flattening and Z ledge heights are recorded. Authored additions, source ambiguity and inset maps are kept separate from confirmed mismatches.

## What the bounded patch corrects

`068fd15` implements the requested compass north alignment. `080fed5` opens the T gorge, ties its approaches, places G beside north-side water, removes Ravenloft substitute geometry while the world site is present, and applies X terrain/cutaway treatment while retaining outdoor lower-level context. G's old camp composition and missing north-side footpath remain. `f18f087` changes only one generated prose field for the release text gate.

Before the approved Amber correction, build/540 units, two authoring checks, nine repeated compass/budget checks and six focused GPU continuity checks pass. The final full suite is **266 passed, 55 existing device skips, one failure in 12.8 minutes**. At X, the compact hard-cut mesh renders one outdoor probe 24.7616 ft below its correct height function. A triangle spans local z292 at -2 ft to z460 at +39.6 ft. This is a confirmed implementation regression; the release is held and an additional targeted correction has been requested under the one-fix limit. See `item2-continuity-report.md` for exact commits, reviews and cost comparison.

## Methods and limits

First desktop images use pre-review-fix `index-B3tGevXq.js`; all 122 levels were inspected in 21 contact sheets with no page/capture errors. Final selected repeats use `index-CF69xAqx.js`: 42 images inspected locally. Early G burial/orientation was corrected; N9 burial survived a settled repeat. Screenshots stay outside Git and uploads.

Final phone entry coverage adds 92 inspected images at 390 by 844. All 44 scenes have DM and Players scene inspection after the entry-movement probe and zoom button responses in both directions; entry movement passes 42/44. On N5, N6, N8 and U3, the original DM zoom sequence selected the parent before Players capture. Four fresh Players captures correct that coverage gap while preserving the original evidence. These checks do not certify every nested target, floor transition or physical phone.

The door probe uses the actual `canWalk` and `moveBlockers` functions, current grid plus room polygons, and points 2 ft on either side of each authored door center. It opens the selected door (and reveals a selected secret door), leaving other walls at default state. A closed-door pass can use an alternate route and is not itself a defect. Missing exterior floor or an oversized lattice excludes a probe. This is a qualified CPU traversal check, not an end-to-end party/link/UI journey.

Both regions also received desktop/phone DM/Players inspection and zoom checks: eight combinations, 16 images, all zoom responses and no page errors. The first regional frames may automatically enter cartography mode, so the extra images are not counted as a separate complete 3D terrain audit. Castle has eight additional baseline images, including exact dungeon repeats.

The link check uses the same square-cell snapping and `canWalk` functions as the app. The separate transition harness executes the exact committed methods after TypeScript stripping and stubs rendering, persistence and reveal side effects. It establishes isolated level-selection behavior without claiming browser event, fog, save or end-to-end traversal coverage. Details and findings: `allmap-movement-coverage.json`.

The Strahd source is the authorized local 258-page PDF; map art is viewed locally and never copied into the repository. Sheep Chase's prior authored export is available. Its official PDF download returned a browser challenge and the browser tool failed twice at startup; original module-image review remains blocked. No access control was bypassed.

## Per-map evidence

The column below identifies partial source/reference evidence; “pending” is not a finding. Every production scene has a desktop DM level overview, a default-entry movement probe, desktop wheel checks and the door inventory. Full-source/visual/traversal sign-off remains separate.

| Map | Levels | Source/reference pass | Baseline structural finding records |
|---|---:|---|---:|
| `ch02/G` | 1 | chapter 2 narrative; qualified | 1 |
| `ch02/J` | 3 | chapter 2 narrative; qualified | 3 |
| `ch02/M` | 4 | chapter 2 narrative; qualified | 1 |
| `ch04/K` | 12 | plan + narrative; partial | 3 |
| `ch09/T` | 4 | plan + narrative; declared structure checked | 3 |
| `ch13/X` | 3 | plan + narrative; declared structure checked | 4 |
| `ch02/A` | 1 | chapter 2 narrative; qualified | 1 |
| `ch02/B` | 3 | chapter 2 narrative; qualified | 1 |
| `ch02/D` | 3 | chapter 2 narrative; qualified | 3 |
| `ch02/F` | 4 | chapter 2 narrative; qualified | 2 |
| `ch02/H` | 3 | chapter 2 narrative; qualified | 1 |
| `ch02/I` | 2 | chapter 2 narrative; qualified | 2 |
| `ch02/L` | 2 | chapter 2 narrative; qualified | 0 |
| `ch02/P` | 3 | chapter 2 narrative; qualified | 1 |
| `ch02/R` | 4 | chapter 2 narrative; qualified | 3 |
| `ch02/barovia-region` | 0 | regional source plan inspected; height interpretation open | 3 |
| `appB/death-house` | 6 | plan + narrative; declared structure checked | 2 |
| `ch03/E5` | 2 | plan + narrative; declared static scope compared | 2 |
| `ch05/N1` | 1 | plan + narrative; declared static scope compared | 1 |
| `ch05/N2` | 3 | plan + narrative; declared static scope compared | 1 |
| `ch05/N3` | 3 | plan + narrative; declared static scope compared | 1 |
| `ch05/N4` | 3 | plan + narrative; declared static scope compared | 1 |
| `ch05/N5` | 1 | plan + narrative; declared static scope compared | 1 |
| `ch05/N6` | 2 | plan + narrative; declared static scope compared | 1 |
| `ch05/N7` | 1 | plan + narrative; declared static scope compared | 1 |
| `ch05/N8` | 1 | plan + narrative; declared static scope compared | 1 |
| `ch05/N9` | 1 | plan + narrative; declared static scope compared | 0 |
| `ch08/S10` | 5 | plan + narrative; declared static scope compared | 1 |
| `ch10/U3` | 2 | plan + narrative; declared static scope compared | 0 |
| `ch07/Q` | 6 | plan + narrative; declared structure checked | 1 |
| `ch08/S` | 3 | plan + narrative; declared static scope compared | 1 |
| `ch10/U` | 2 | plan + narrative; declared static scope compared | 0 |
| `ch11/V` | 4 | plan + narrative; declared static scope compared | 3 |
| `ch12/W` | 4 | plan + narrative; declared static scope compared | 4 |
| `ch14/Y` | 2 | plan + narrative; declared static scope compared | 1 |
| `ch15/Z` | 2 | plan + narrative; declared static scope compared | 1 |
| `ch02/C` | 1 | chapter 2 narrative; qualified | 1 |
| `ch03/E` | 1 | plan + narrative; declared static scope compared | 2 |
| `ch05/N` | 1 | plan + narrative; declared static scope compared | 0 |
| `ch06/O` | 4 | plan + narrative; declared static scope compared | 1 |
| `wsc/00-region` | 0 | authored export; publisher image pending | 1 |
| `wsc/01-tavern` | 2 | authored export; publisher image pending | 0 |
| `wsc/02-street` | 1 | authored export; publisher image pending | 1 |
| `wsc/03-compound` | 4 | authored export; publisher image pending | 0 |
| `wsc/03a-road` | 1 | authored export; publisher image pending | 0 |
| `wsc/03b-path` | 1 | authored export; publisher image pending | 0 |
| `dev/m0-test-room` | 2 | N/A canonical source; development fixture | 0 |

## Decisions and release gates

Matt explicitly approved the additional X mesh correction/retest on 2026-10-14 ("nah just go for it"). It now has two focused reviews, a passing build, 543 passing units, 15 passing continuity tests and a clean frozen full GPU run: **267 passed, 55 existing device skips, zero failures in 13.5 minutes**. The outdoor error is 0.00015625 ft; the immediate valley frame uses 298,844 triangles with the original 300,000 limit. Twelve refreshed Amber images were inspected locally. All verification browsers exited and GPU use was released by 03:50 UTC. CI `38505966683` on `f9e099c` passes typecheck/units/desktop-host steps; its browser result was still pending at 03:47:57 UTC. The broader regional heightfield/drainage and entrance-placement boundary remains a separate pending question. Do not merge paused item 7 or reinterpret recorded source conflicts silently. The approved-correction section in `item2-continuity-report.md` preserves the failed/interrupted run history and exact evidence limits.

No 0.3.1 version bump, main merge, desktop update, publication or distribution tag has occurred. Public compiled-bundle publication remains held by the parent task. Installed 0.3.0 stays usable.

Evidence in this repository: `allmap-audit-inventory.json`, `allmap-source-ch02.json/.md`, `allmap-source-structures.json/.md`, `allmap-source-wsc.json/.md`, `allmap-source-remaining.json/.md`, `allmap-source-images.md`, `allmap-movement-coverage.json`. Detailed CPU/runtime probes and all screenshots remain in the local task evidence directory, not Git.
