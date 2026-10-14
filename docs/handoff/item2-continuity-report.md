# Item 2d: 0.3.1 continuity checkpoint

2026-10-14. Implementation base `785421cb45ad3b7a5467a14f6e696074efb9bd27`; worktree `.worktrees/continuity`, branch `item2-continuity-031`. This is a tested WIP checkpoint, not a release. Installed 0.3.0 remains unchanged.

## Scope and authority

Matt requested local terrain continuity at Tsolenka Pass, Tser Pool, Ravenloft and Amber Temple, plus north alignment from either compass. He then expanded the logic audit to every available map in both campaigns. On 2026-10-14 he resolved the release boundary: "Every map's logic should be correct for 0.3.2." The 0.3.1 release retains the bounded local corrections with explicit limits; comprehensive regional heightfield/drainage, J/K placement and all-map logic follow in item 2e as 0.3.2. No item 7 branch has been merged; any specific component required for 0.3.2 must be identified and reviewed independently.

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

The original final-review bundle was `index-CF69xAqx.js`; its results below are preserved. The approved Amber correction is `index-DSh4mmpD.js`, with its separate verification record below. Those bundles carry 0.3.0. The authorized 0.3.1 version/changelog candidate is now prepared and requires its own final release verification; installed 0.3.0 remains unchanged.

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

### Versioned 0.3.1 candidate

After Matt assigned comprehensive geography to 0.3.2, both package versions and the dated 0.3.1 changelog were prepared. Fresh main `785421c` is already included; the merge command reported already up to date. No application implementation changed from the approved Amber checkpoint. Build `index-CoeOhM3n.js` passes, as do 543 unit tests (two existing todo) and all 21 desktop-host tests. The initial unit attempt hit sandbox temporary-file lookup errors and lacked the existing PDF extractor on its process PATH; the unchanged tests pass outside that sandbox with the existing extractor. Both logs are retained.

The versioned candidate was frozen separately for its full GPU suite: 204 files, 17,145,309 bytes; sorted manifest SHA-256 `f1769fb11275aee02b37a49a168e80f007729e45511052078d0f97fbbd34bbc5`. Its own full suite completed by 04:34:54 UTC: **267 passed, 55 existing device skips, zero failures in 13.0 minutes**, including the version/What's new checks and unchanged ground, triangle and resource assertions. Post-run hashing confirms every frozen file and the manifest are unchanged. The preview and verification browsers have exited. The fresh copied-text scan covers 258 OCR pages and finds the same seven reviewed canonical name/rule-list matches. The audit-document scan finds only numeric sequences, no descriptive prose match. CI `38510870342` on exact `1c8d94a26764eeafc91a12db234976f2b8f9bb7f` completed successfully at 05:42:02 UTC, freshly confirmed at 07:55 UTC. Public distribution remains held.

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

Settled region measurements differ from the full-suite immediate-frame triangle budget; both are reported as measured. This table predates the approved Amber correction. That correction resolves the rendered-ground failure and passes the five-round-trip retained-resource check in the clean full suite recorded above; its separate cost measurements supersede this table's Amber candidate values. The resolved Amber regression and final versioned verification are closed; the final release reconciliation is recorded below.

## Release-scope decision for Matt

The green tests establish that the bounded patch passes its tested assertions. They do not establish completion of the requested geographic logic. The remaining work falls into three different categories; an audit finding is not automatically permission to implement it.

| Requested outcome | Verified result | Still needed before claiming that outcome complete |
|---|---|---|
| Compass north alignment | Both compasses preserve place, zoom and pitch; desktop/phone and keyboard checks pass | No outstanding scoped defect identified |
| Coherent Tsolenka crossing and approaches | Gorge opened and local bridge/road joins corrected | Regional approaches still reach 167%/159% grade; reconcile the approach elevations with the source-backed regional terrain |
| Poolside Tser and coherent water connections | Camp sits beside north-side water; local shore/river ties corrected | H/G/D datums still rise downstream, about 336 -> 366.55 -> 487 ft; regional drainage remains incoherent |
| Ravenloft duplicate ownership and parent-child continuity | Substitute geometry suppressed while the real world site is present | J gates and K castle remain 4,598 ft apart horizontally and about 584 ft vertically despite their contiguous entrance relationship |
| Exposed Amber approach and terrain/building continuity | Production ground raycasts, excavation walls and section views pass | Reconcile the mountain-enclosed source structure with the open excavation treatment; passing the approach-height test does not settle the full mountain envelope |
| Apply the logic audit to every available map | Inventory, source/reference records and bounded runtime evidence cover all 46 maps / 122 scene levels | Reconcile remaining source/render/traversal criteria or record their limitations; publisher source for Sheep Chase is unavailable, and complete traversal is not certified |

The regional T/G/J-K issues above remain gaps in the requested continuity outcome. Matt has now assigned their comprehensive correction to 0.3.2, explicitly resolving the earlier choice between a bounded and expanded 0.3.1. Ship the verified local corrections in 0.3.1 with these named limits after its release checks pass. Amber's source-backed mountain envelope belongs in the 0.3.2 work too. Do not describe all road, river and map logic as fixed by 0.3.1 or mark item 2d released before it reaches main.

The new 0.3.2 authority includes the audit's terrain, placement, doorway/blocking-wall, stair/multiple-hop and source-geometry findings, including N9/H/K burial, the Sheep Chase tavern/street gap, missing G footpath and X9 stair descent. It does not authorize silently reversing prior source adaptations or guessing at ambiguous source conflicts. The expanded Player Display and comprehensive phone/performance pass remain deferred except for regressions caused by this work. Do not wholesale merge item 7: identify each component essential to all-map logic, preserve its branch and attribution, and verify it under 0.3.2. Existing item 11 findings should be reconciled when their logic is actually corrected, not double-implemented.

At 04:02 UTC on 2026-10-14, exact checkpoint CI `38508583254` on `55b118e0b78a89b04d0780dd0c713f0a54632c9c` has passed typecheck, units and desktop-host tests; browser checks are still running. Main is freshly confirmed at `785421c` and is already an ancestor; cloud item 2 remains `4f3cad9`. Public desktop bundle/feed publication remains a separate held action even after source-release gates pass.

## All-map audit and remaining gates

`allmap-audit-inventory.json` inventories 46 production maps: two regions and 44 scenes with 122 levels. Schema checks pass on all 45 scenes including the development fixture; all 120 rigid-placement assertions pass. These do not prove canonical scale, adjacency, unburied terrain or traversability.

All 44 production scenes/122 levels have a first desktop DM visual triage. Forty-two of 44 initial Players movement probes pass; Abbey and Sheep Chase square fail. Desktop wheel zoom responds both ways in all 44. The final phone audit inspected 92 images covering DM/Players scene views after the movement probe on all 44 scenes; movement passes 42/44 and zoom responds both ways in 44/44, with zero page errors. Four child Players entries were recaptured fresh after the original zoom sequence selected their parent. A CPU probe checks 365 doors: 290 open passes, 28 blocked, 47 inapplicable; 25 blocked open apertures overlap a second normal wall. These bounded probes do not certify every doorway/link journey or complete source fidelity. Chapter 2 narrative comparisons cover 13 maps/34 levels; the structure source batch covers five maps/31 levels/45 comparisons, and Sheep Chase has six maps/nine levels/15 authored-reference comparisons. The remaining 21 Strahd scenes / 48 levels now have 48 comparisons, 18 primary source pages and 48 CPU diagrams inspected. All 39 Strahd scenes / 113 levels therefore have declared source evidence; the three batches record 140 relationships. Original Sheep Chase publisher-map review remains blocked. Both regions have eight desktop/phone DM/Players view combinations inspected and responsive zoom in both directions. Castle dungeon burial reproduces on frozen 0.3.0; it is not caused by this patch. Exact link-method isolation also finds 56 wrong destination levels / 22 multiple transitions across 346 activations; its methods and every scene link array are unchanged from baseline. These extend the existing item 11 finding. The ledger remains open until each applicable criterion has evidence or a justified limitation.

The earlier implementation and first audit checkpoint were pushed without a main merge to `claude/wip/item2-nested-world-laptop` at `3da4420767adf76b8e73c0330fef4c077cfcb749`. At that earlier checkpoint its CI run `38496911286` passed typecheck, unit and desktop-host steps and was running browser tests; current verification is recorded in the approved-correction section above. Main remains `785421c`, cloud item2 remains `4f3cad9`; their older successful checks are not substituted for current CI.

Final source-release reconciliation, 2026-10-14: the independent regression reconciliation passed, followed by refreshed acceptance and correctness reconciliations against exact `1c8d94a`. Acceptance rehashed all 204 frozen files with zero mismatches; correctness closed the earlier ribbon-normal and approved Amber findings without another implementation pass. Local review records are `final-review-acceptance-031-current.md` and `final-review-correctness-031-current.md`; the completed regression reviewer returned its result to the coordinator. Fresh main at 07:55 UTC is `785421cb45ad3b7a5467a14f6e696074efb9bd27`, already an ancestor. Both package versions, the dated changelog and Help output are 0.3.1. The final release-record commit changes documentation only and must retain byte-identical verified output, pass its required build/unit check and exact-head CI before main is advanced. Release-record verification completed at 07:58 UTC: build passed, 543 units passed (two existing TODOs), and 21 desktop checks passed. All 204 rebuilt files match the frozen GPU-verified output byte for byte; no new GPU run is needed for unchanged bytes. No tag, compiled bundle, feed or screenshot is part of this source release. Matt assigned comprehensive all-map logic to 0.3.2; all named limits above remain open there.

Local evidence (not committed): worktree `evidence/final-*.log`; task workspace `evidence/continuity-031/final-cost/results.json`, `final-views/results.json`, final review reports and source-audit evidence. Screenshots and source pages stay local.
