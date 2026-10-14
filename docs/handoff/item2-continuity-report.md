# Item 2d: 0.3.1 continuity checkpoint

2026-10-14. Implementation base `785421cb45ad3b7a5467a14f6e696074efb9bd27`; worktree `.worktrees/continuity`, branch `item2-continuity-031`. This is a tested WIP checkpoint, not a release. Installed 0.3.0 remains unchanged.

## Scope and authority

Matt requested local terrain continuity at Tsolenka Pass, Tser Pool, Ravenloft and Amber Temple, plus north alignment from either compass. He then expanded the logic audit to every available map in both campaigns. The implementation retains the requested bounded local scope. Broader regional heightfield/drainage and J/K world-placement correction are still awaiting the pending owner boundary decision. Item 7 remains paused; none of its branches was merged.

Public compiled-bundle publication and a distribution tag remain held by the parent task. Source release, desktop update, source-map audit and publication are separate gates. The hold covers only new public compiled bundles and the update feed; it does not block authorized private WIP pushes or later private Site deployment once all release gates pass. No source book art, screenshots or copied descriptions are published by this checkpoint.

On 2026-10-14 Matt explicitly approved the additional Amber correction and retest ("nah just go for it") after being told that it exceeds the original final fix-pass allowance. This limited exception covers the confirmed hard-cut mesh regression and its verification. It does not resume unrelated regional work, item 7, or public compiled-bundle publication.

## Commits

- `068fd154a368e7a490b807a76cb1a613d72fdf49`: local and regional compass activation aligns north while preserving target, distance and pitch. Native buttons support click, tap, Enter and Space; reduced motion is immediate, normal motion follows a short arc, and new camera input cancels that arc. Player Display controls remain disabled.
- `080fed5642fa6e575a989f6d8b4e2a8bf8ecece5`: generated local/world road and water ties, Tsolenka gorge opening and grid clipping, north-side Tser water/shore, removal of Ravenloft substitute geometry while the true world site is present, and Amber terrain/cutaway treatment. Outdoor lower levels retain regional context. River/road ribbon normals and cut mesh cost are corrected.
- `f18f087486f39dc4acb8de4199c43776fbef9fe5`: one Death House description reworded through its generator for the copied-text gate, with its collaboration-ledger row. Exact generated scene diff is one prose field; geometry and rule links are unchanged.
- `e37734dff30e61ff16ae816ddb294dca4fe46300`: owner-approved additional Amber hard-cut correction, rendered-height and four-wall regressions, and focused review records.
- `f9e099cee9997287ad027a8cb498742df2b05205`: accelerates the exhaustive edge test by pruning only triangles that cannot intersect its rays. All probes, assertions and the five-second timeout remain intact.

## Review and verification

Each of the two build steps received two reviews and at most one fix pass. The final correctness, regression and acceptance reviews are complete; the single final fix pass is complete. It corrected missing ribbon normals, the source-backed northern Tser shoreline, the remaining prose overlap, excessive cut-grid triangles, and the compass test's unstable raw-coordinate interaction after a layout change. No additional polish loop has started.

The original final-review bundle was `index-CF69xAqx.js`; its results below are preserved. The approved Amber correction is now `index-DSh4mmpD.js`, with its separate verification record below. Package version remains 0.3.0 until the 0.3.1 release gates are resolved.

| Check | Result |
|---|---|
| Build | Pass |
| Full units | 35 files, 540 passed, two existing todo, zero skips/failures |
| Authoring regressions | Two passed |
| Continuity CPU regressions | 12 passed, including finite ribbon normals and north-side water |
| Repeated compass + valley triangle budget | Nine GPU checks passed; three repetitions per selected check |
| Focused continuity | Six GPU checks passed, including desktop/phone and DM/Players |
| Final full GPU suite | 266 passed, 55 existing device skips, one failure in 12.8 minutes |
| Rules terms | 6,108 fields, 5,884 links, zero unreviewed |
| Module-overlap scan | 258 pages; seven remaining canonical name/rule-list matches, no flagged descriptive sentence |

The first full GPU run on the preceding bundle `index-CNfvXVpQ.js` had 265 passes, 55 existing device skips and two failures. The compass fixture clicked raw coordinates while the Players layout was changing; it now uses locator actionability. The existing 300,000-triangle valley limit failed at 316,960; the cut mesh now retains all cut boundaries without the excessive uniform/outer-ring Cartesian grid, removing 18,994 combined T/X cut triangles. Assertions and thresholds were not loosened. The final full rerun found one additional failure: Amber's outdoor centre renders 24.7616 ft below its correct height function. A raycast identifies a triangle spanning local z292 at -2 ft to z460 at +39.6 ft, an unintended 168-ft ramp. The reduced hard-cut grid lacks a separate outside-edge height. The assertion remains unchanged. That checkpoint requested an additional targeted correction under the explicit one-fix limit; Matt subsequently approved it as recorded below.

### Approved additional Amber correction, 2026-10-14

The hard-cut grid previously shared one boundary vertex between the room excavation and its outdoor neighbour. A triangle then joined the -2-ft cut floor at local z292 to the +39.6-ft apron at z460, rendering the z360 outdoor probe 24.761613 ft too low. The production-coordinate raycast reproduced that exact error before implementation. Adjacent cells now select the height on their own side of each cut, reuse matching vertices, and close height differences with vertical faces. The broad room-edge regression uses flat surrounding ground to isolate this discontinuity from the regional heightfield's existing coarse interpolation; the real approach and lip are also raycast directly.

Two independent focused reviews are complete. The first found incorrect winding on two vertical wall directions. A horizontal-ray test failed before its correction; all four walls now face into the excavation. The second review found no further actionable defect. An additional review of the CI test acceleration confirms it cannot remove a possible probe hit. The original full-suite ground tolerance (0.5 ft), valley budget (300,000 triangles), every probe and the unit timeout are unchanged.

| Final verification | Result |
|---|---|
| Build | Pass; `index-DSh4mmpD.js` |
| Full local units | 35 files, 543 passed, two existing todo, zero skips/failures |
| Continuity units | 15 passed |
| Final focused GPU ground/budget checks | Two passed, 11.7 seconds |
| Frozen full GPU suite | **267 passed, 55 existing device skips, zero failed, 13.5 minutes** |
| Repeated Amber tooltip GPU check | Three passed, 14.6 seconds |
| Refreshed visual inspection | 12 local images: desktop/phone, DM/Players, facade/upper/lower |
| Outdoor centre error against intended ground | 0.00015625 ft; previously 24.761613 ft |
| Just outside/inside excavation lip | Errors 0.00015625 / 0.000058594 ft |
| Immediate whole-valley frame | 49 draws, 298,844 triangles (limit remains 300,000) |
| Amber facade render completion | 675 draws, 401,226 triangles; median 3.1 ms, p95 4.6 ms |

The final facade sample used desktop 1366 by 768, ten warm-up frames and forty forced renders with WebGL `finish`, after the suite exited. It measures completion cost, not FPS, streaming hitches or physical-phone performance. The whole-valley probe used 1024 by 768. The existing five-round-trip resource check passed in the full suite. Every verification browser exited; this task released the GPU by 03:50 UTC without reinstating an app reservation.

Apron geometry changes from 83,876 to 84,752 triangles and from 43,015 to 43,461 vertices; it remains one mesh/material with no extra draw calls. A CPU-only comparison used one warm-up pair then six alternating builds per version, production root sites and crags disabled in both versions because their canvas texture requires a browser. Median land construction: 241.5 ms before, 261.8 ms after; ranges 236.7-252.7 and 256.3-309.0 ms. This is construction cost, not frame time.

Frozen output: 204 files, 17,145,601 bytes, `index-DSh4mmpD.js`; sorted file-manifest SHA-256 `d6c7040a1f24b97224a47bb4bc078d727ffde57788d79ee52d2d425003bbf65b`. Its preview used a separate frozen copy on port 5643, untouched throughout the accepted full run.

Verification history is retained:
- At Matt's direction to give SD priority, an initial full run was interrupted at 03:10 UTC after 18 logged passes; its isolated runner/browser exited. Verification resumed after SD reported its successful Generate/Cancel smoke test.
- CI `38505511097` on `e37734d` failed only because the exhaustive edge test exceeded its unchanged five-second timeout on the slower runner (7.168 seconds). Reviewed correction `f9e099c` prunes only triangles outside every probe's X/Z footprint. Current CI `38505966683` on that exact commit passes typecheck, units and desktop-host checks; browser checks were still running at 03:47:57 UTC.
- The first resumed local full run had 266 passes, 55 existing device skips and one app-load timeout before the Amber tooltip assertion (14.4 minutes). The served output was rebuilt during that run for the CPU-test correction, so that run is not accepted as clean verification. This is a suspected test-environment cause, not a proven app defect. The same check then passed three times without app/test changes, followed by the clean frozen full run above.

The 12 refreshed images show the approach exposed and unrevealed Players interiors masked. They stay outside Git and uploads. Unrelated generated-file newline changes remain unstaged. No region placements, authoring data, materials, versions, release tags or installed app were changed for this correction.

Local evidence, outside Git: `evidence/amber-approved-red.log`, `amber-approved-wall-red.log`, `amber-approved-green.log`, `amber-ci-build.log`, `amber-ci-unit.log`, `amber-final-focused-gpu.log`, `amber-frozen-tooltip-gpu.log`, `amber-frozen-full-gpu.log`, `amber-final-probe.log`, and `amber-approved-cpu-cost.json`. The task evidence directory also holds `amber-approved-probe.json`, `amber-approved-frozen-manifest.json`, the frozen bundle and the 12 locally inspected images. Earlier failed/interrupted logs are preserved.

## Visible results and limits

Forty-two final-build desktop/phone, DM/Players screenshots were inspected locally, including settled repeat views. Tser is exposed beside water to the north; its circular shore is an authored approximation, not a claim to trace every source contour. Its older tent/wagon/horse composition and missing riverside footpath remain audit findings. Tsolenka has an open gorge under its bridge, but the regional approaches and sharply angular terrain are still incoherent. Removing the substitute castle does not close the 4,598-ft gap between the true J and K placements.

Amber's entrance and section-navigation interiors are accessible to the camera, but the source describes a structure extending into a mountainside. The excavation treatment does not prove the entire temple should be an open-air pit. Mountain-envelope modeling and the source audit's X9 stair-height discrepancy remain unresolved. Unexplored floors viewed manually as Players correctly remain dark.

The broader audit's settled repeats confirm N9 camp burial and H regional terrain filling the canyon. N6 weak wall silhouettes remain a candidate requiring section-height interpretation. L water/material mismatch, P river joins, M rectangular boundaries, Y terrain and the mill attic remain tracked with their evidence limits. They are not silently repaired in this final pass.

## Cost comparison

Same laptop, desktop 1366 by 768, isolated context per case/version, frozen 0.3.0 baseline followed by candidate, ten warm-up frames and forty forced renders completed with WebGL `finish`. This measures CPU/GPU completion cost, not interactive FPS, streaming hitches or physical phone performance. No competing media/GPU job ran during measurement.

| View | Draw calls baseline / candidate | Triangles baseline / candidate | Median ms baseline / candidate | p95 ms baseline / candidate |
|---|---:|---:|---:|---:|
| Settled region | 8 / 8 | 233,478 / 244,210 | 0.5 / 0.5 | 0.9 / 0.7 |
| Vallaki | 216 / 215 | 1,860,183 / 1,813,180 | 0.8 / 0.9 | 1.1 / 1.5 |
| Blue Water Inn | 156 / 156 | 1,346,736 / 1,357,432 | 1.2 / 1.4 | 1.8 / 1.9 |
| Death House | 164 / 164 | 387,116 / 397,812 | 1.2 / 1.2 | 1.6 / 1.6 |
| Sheep Chase square | 90 / 90 | 83,330 / 83,330 | 0.7 / 0.6 | 0.8 / 0.9 |
| Tsolenka | 99 / 99 | 349,172 / 360,031 | 0.9 / 0.9 | 1.1 / 1.2 |
| Tser | 84 / 85 | 361,178 / 372,121 | 0.6 / 0.7 | 0.8 / 0.9 |
| Ravenloft gates | 241 / 234 | 491,538 / 498,860 | 1.3 / 1.4 | 1.8 / 1.6 |
| Amber facade | 675 / 675 | 389,654 / 400,350 | 2.9 / 2.9 | 3.5 / 3.7 |

Settled region measurements differ from the full-suite immediate-frame triangle budget; both are reported as measured. The full suite passed its five-round-trip retained-resource check; the separate Amber rendered-ground failure blocks release.

## All-map audit and remaining gates

`allmap-audit-inventory.json` inventories 46 production maps: two regions and 44 scenes with 122 levels. Schema checks pass on all 45 scenes including the development fixture; all 120 rigid-placement assertions pass. These do not prove canonical scale, adjacency, unburied terrain or traversability.

All 44 production scenes/122 levels have a first desktop DM visual triage. Forty-two of 44 initial Players movement probes pass; Abbey and Sheep Chase square fail. Desktop wheel zoom responds both ways in all 44. The final phone audit inspected 92 images covering DM/Players scene views after the movement probe on all 44 scenes; movement passes 42/44 and zoom responds both ways in 44/44, with zero page errors. Four child Players entries were recaptured fresh after the original zoom sequence selected their parent. A CPU probe checks 365 doors: 290 open passes, 28 blocked, 47 inapplicable; 25 blocked open apertures overlap a second normal wall. These bounded probes do not certify every doorway/link journey or complete source fidelity. Chapter 2 narrative comparisons cover 13 maps/34 levels; the structure source batch covers five maps/31 levels/45 comparisons, and Sheep Chase has six maps/nine levels/15 authored-reference comparisons. The remaining 21 Strahd scenes / 48 levels now have 48 comparisons, 18 primary source pages and 48 CPU diagrams inspected. All 39 Strahd scenes / 113 levels therefore have declared source evidence; the three batches record 140 relationships. Original Sheep Chase publisher-map review remains blocked. Both regions have eight desktop/phone DM/Players view combinations inspected and responsive zoom in both directions. Castle dungeon burial reproduces on frozen 0.3.0; it is not caused by this patch. Exact link-method isolation also finds 56 wrong destination levels / 22 multiple transitions across 346 activations; its methods and every scene link array are unchanged from baseline. These extend the existing item 11 finding. The ledger remains open until each applicable criterion has evidence or a justified limitation.

The earlier implementation and first audit checkpoint were pushed without a main merge to `claude/wip/item2-nested-world-laptop` at `3da4420767adf76b8e73c0330fef4c077cfcb749`. At that earlier checkpoint its CI run `38496911286` passed typecheck, unit and desktop-host steps and was running browser tests; current verification is recorded in the approved-correction section above. Main remains `785421c`, cloud item2 remains `4f3cad9`; their older successful checks are not substituted for current CI.

Before a 0.3.1 source release: obtain the exact current CI terminal result, reconcile the all-map audit scope and pending regional decision, refresh/merge current main as required, update both version files and changelog, finish release verification, then push main only under the explicit release authority. Distribution publication remains a separate held action.

Local evidence (not committed): worktree `evidence/final-*.log`; task workspace `evidence/continuity-031/final-cost/results.json`, `final-views/results.json`, final review reports and source-audit evidence. Screenshots and source pages stay local.
