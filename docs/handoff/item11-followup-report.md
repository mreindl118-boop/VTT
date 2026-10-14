# Transition follow-up for 0.3.2

2026-10-14. Independent dispatcher lane, continuing tested checkpoint `166259b7b7399beea3791a04f0808cb03d0ab615`. Parent explicitly assigned these follow-up cases. No authoring, generated map, main.ts, renderer-module, version or release changes.

## Confirmed defects and correction

Three failing-first unit regressions cover Argynvostholt nearest automatic destination under reversed link order, Death House equally near up/down choices, and Castle K85 same-level endpoint direction. Automatic traversal now collects only newly entered endpoints, chooses the unique nearest, and waits for an explicit choice on a distance tie. String requests retain compatibility; structured requests `{linkId, from: 'from'|'to'}` select a precise source endpoint. `App.takeLink(id, from?)` exposes this direction to future marker wiring.

`afterPartyMoveFromUi(previous?)` accepts the prior level and position, suppresses no-op/walk-off activation, and permits newly entered or different-floor placements. Its browser regression failed before the dispatcher change. **The production context-menu caller is not yet fixed:** ownership for the main.ts action is pending. A separate diagnostic exercised its actual menu button on the new dispatcher build and reproduced both no-op and walk-off f1→f2 failures because the caller supplies no snapshot. Capture prior pose before mutation and pass it through.

Two existing guard-test fixtures now use an unambiguous route/landing; all their assertions remain. The new tie tests independently prove that ambiguous landings require explicit up/down choice. No existing test assertions, thresholds, timeouts or skips were weakened.

## Exact UI ownership dependencies

- `app/src/main.ts:563`: only the `Move party here` action needs the prior-pose plumbing. Capture `const previous = { level: t.level, pos: [t.pos[0], t.pos[1]] as [number, number] };` before replacing the level/position; then call `app.afterPartyMoveFromUi(previous)`. This caller was not edited. The external `context-menu-repro.mjs` exercises the actual menu button for both no-op and walk-off.
- `app/src/app.ts:401-426`, `loadSteps()`: preserve distinct link/endpoint choices instead of the greedy 12-ft discard; include endpoint side in unique label identity and call `takeLink(spec.linkId, spec.linkEnd)`.
- `app/src/render/build.ts:45`, `LabelSpec`: add endpoint metadata such as `linkEnd?: 'from' | 'to'` for that wiring. A chooser or non-overlapping action layout may also need UI/CSS ownership; no new UI files are assumed here. Actual Players return-marker invisibility needs investigation in the label visibility path before claiming actionability.

## Interaction coverage and limits

The earlier desktop marker listener test was strengthened to actual Playwright pointer click, with ordinary visibility/occlusion checks. A real phone upward touch passed; a Players-view return touch then failed because the return marker was invisible after departure. That failure is retained in the external evidence log as an unowned UI integration gate. The bounded journey switches back to DM view for the return action; it does not certify the failed Players interaction.

The pointer journey successfully approached, transitioned once and departed using screen-coordinate pointer input. Its first continuation attempt failed after reload: party state was still f2, but the visible floor reset to entry f1, so no Floor 1 return marker existed. The bounded continuation uses the visible Floor selector to reopen f2 before the real return click; this is not automatic visible-floor restoration. The original failure log is preserved.

The 346-direction sweep still assigns source endpoints and calls takeLink with nested=0. It proves destination dispatch, not approach walking, all-map source correctness, or visible marker actionability. Nested-world pointer/touch journeys supplement it only for the tested Death House routes. Same-level/collocated marker coverage remains pending endpoint and chooser UI wiring.

Two implementation reviews and three final review passes found no dispatcher must-fix. They independently retained the two caller dependencies and the marker-choice gate. Full hardware GPU and integrated CI remain laptop work. Software Chromium/SwiftShader is not a substitute.

## Verification

Build passes on `index-mtk0YbWq.js`. Full serial units: **560 passed, two existing source-cache skips, two existing TODOs, zero failures**, all 36 files; all 19 focused transition units pass. The combined browser run passed 14 checks including all 346 directions with zero wrong levels/multiple transitions/destination failures, and retained one new pointer-continuation failure caused by the entry-floor view after reload. The revised bounded continuation through the visible Floor selector passed separately in 31.6 seconds. No full-suite clean-pass claim is made for that initial 14/15 run. The phone DM-touch journey and Players pointer approach/departure are verified; Players-only return visibility and automatic view restoration remain open.

Frozen output: 204 files / 17,147,282 bytes, manifest SHA-256 `58785c3000c555b3fc0aabb0bd3e8769716f60cedb23d84659f9df9d1090bca7`, using the same per-file manifest method as the preceding checkpoint. The build stayed unchanged throughout browser verification. Evidence logs are outside Git: `followup-unit-red.log`, `followup-browser-red.log`, `context-menu-repro.log`, `followup-focused-browser.log`, `followup-full-unit-serial.log`, `followup-final-browser.log`, and `followup-pointer-resume.log`. The default 36-worker unit attempt hit two existing five-second timeouts (continuity Gates proxy and terms DC count); the unchanged suite is rerun with one worker to remove resource contention. No timeout changes.

## Ownership packet (historical read-only findings at checkpoint 166259b)

The packet below predates the dispatcher follow-up above. Its automatic-selection finding is now corrected in core; its UI callers and authoring proposals remain pending.

# Read-only landing and marker handoff

2026-10-14. Analyzed checkpoint 166259b7b7399beea3791a04f0808cb03d0ab615, base 55b118e. Latest remote laptop WIP remains 1c8d94a26764eeafc91a12db234976f2b8f9bb7f. No repository edits or generation. Source support below is inherited from committed source audits and authoring intent, not a fresh book inspection. Existing arrival-runtime.json supplies actual-app bounded departure probes; no GPU claim.

## Six landing repairs for authoring owners

All six currently have no successful tested departure at eight directions and radii 2.5/5/10 ft from either authored or snapped endpoint. This is bounded evidence, not exhaustive path search.

| Scene / link / destination | Exact authoring source | Minimal proposal and support |
|---|---|---|
| ch04/K / lk-k51 / south-tower [190,256] | scripts/authoring/castle-ravenloft.py:334,343,592 | Move both trap-k51-top and link endpoint to [190,252], i.e. m3(20,28.2). Candidate is inside current K55 polygon; current endpoint is 1 ft outside. However the lower endpoint is [190,263]: this candidate increases horizontal hatch misregistration from 7 to 11 ft. Validate/align both sides of the hatch against the plan rather than treating point containment as sufficient. item6-map-groups.json already records this intended repair, but it is absent here. Preserve hidden hatch semantics and verify descent/ascent. Rerun ravenloft-exterior.py if required by castle generation contract. |
| ch09/T / T-stair / tower-upper [253,360] | scripts/authoring/tsolenka-pass.py:127,197-202,265 | Landing candidate STAIR_HEAD=(51.1,71.5) cells = [255.5,357.5] is inside T5, as earlier item6 notes propose. Current point lies in stair opening 1.743 ft outside floor. Also split the continuous RAIL at the real stair head; endpoint-only movement must not cross an intact rail. Align final stair run/landing. Source audit allmap-source-structures.json T-02, printed pp.158-159, supports internal stair reaching upper floor. |
| ch02/R / R-ledge-steps / notch [343.8,87.4] | scripts/authoring/wild_r.py:356-371,519-532,547,554 | Link uses shelf_pt(east,.8,.85), beyond the tapered floor. Candidate shelf_pt(east,.8,.6)=[347.09,67.69] is on current floor. Prefer matching the intended step head and shelf outline together; do not silently lengthen the climb. Generator defines custom ledge access; committed ch02 source audit supports the crossroads/river relationships, not these exact shelf dimensions. |
| ch02/R / R-shelf-climb / notch [261.3,74.6] | scripts/authoring/wild_r.py:356-371,519-532,548,555 | Current shelf_pt(west,-.2,.8) misses the tapered floor by 23.186 ft. Candidate shelf_pt(west,0,.4)=[272.62,44.38] is on floor but substantially moves the climb. Owner should choose a coherent foot/head pair on the existing shelf or correct a demonstrably mismatched shelf footprint. These are authored adaptations, not a book-mandated coordinate correction. |
| ch03/E5 / lk-ground-undercroft / undercroft [35,38] | scripts/authoring/import-ml.py:10,109,149-153,168 | Converter copies identical endpoint coordinates between floors; lower floor ends at z=30. Restore the source-supported southern stair projection and stair-foot registration, or author a validated lower endpoint inside E5g after establishing stair run. Do not simply clamp to the rectangle. allmap-source-remaining.json E5-01/02 (printed pp.46-47) records projection, 15-ft descent and earth floor; current datum is -14. Required ML seed is absent in cloud. Script currently regenerates E5/E/G/C and character recipes unconditionally: add a scoped E5-only path before owner regeneration, preserve unrelated outputs; downstream vallaki-sites.py copies E5 for N1. |
| ch08/S10 / lk-road / ground [132.5,-7.5] | scripts/authoring/krezk-abbey.py:116-129,424,448-450; shared krezk_land.py | Endpoint is covered by rendered ground-ledge and ground-road9 prism polygons, but is 67.546 ft from declared walkable floor. Minimal likely repair is to include the already-authored road strips (ROAD_N/ROAD_E) and necessary ledge approach in collision floor, preserving cliff boundaries and gate/curtain blockers. Do not relocate party straight into courtyard or add a bounding rectangle over the cliffs. Source audit S10 and generator describe a switchback approach. This overlaps laptop terrain/placement ownership. |

Numerical candidates above received only point-in-current-floor checks using Shapely; they are proposals, not tested corrections. Owner acceptance: generate only owned outputs; validate polygon membership and stair/mesh registration; actual Players arrival plus departure and reverse traversal with doors closed/open as relevant; preserve vertical heights and source-supported shapes; run build/units and laptop interaction/GPU gates.

## Shared markers

app/src/app.ts:401-410 greedily drops any endpoint within 12 ft of an earlier endpoint, regardless of link ID, kind or destination. Reusable exact ledger: marker-suppression-ledger.json. Counts: Castle K 27; Death House 6; Q 4; W 4; WSC compound 2; V 2; O 2; X 1 = 48 endpoints, eight scenes. This counts suppressed endpoint entries, not 48 proven inaccessible routes.

Confirmed Death House: f2 loses lk-spiral-2-3 to f3 because lk-spiral-1-2 occupies the same landing; f3 loses the attic stair. Dumbwaiters are also discarded near stairs despite being distinct transport kinds. Geometry generation is not the correct place to repair this UI issue.

Minimal proposal: preserve distinct (link ID, endpoint side, destination) actions. For spatial clusters, expose a compact chooser or independently actionable labels; simply removing dedup creates overlapping buttons and is insufficient. Never merge by destination floor alone (distinct routes can reach the same floor). Give same-level endpoint labels unique IDs and pass explicit endpoint side, since link ID alone cannot identify which clicked endpoint is intended. Test actual pointer/touch access, not only element.click, on desktop and phone, DM/Players; Player Display remains non-authoritative. Requires parent ownership of app.ts label creation and any chooser UI before editing.

## Additional transition edges found by read-only inspection

1. app/src/main.ts:563 Move party here mutates level/position then calls app.ts:1338 afterPartyMoveFromUi without previous position or movement delta. On a fresh/reloaded landing, a no-op context-menu action can dispatch stairs; first movement within the trigger can differ from moveTokenTo's guarded behavior. Needs failing browser regression before a fix; proposed API supplies original level/position or funnels the action through existing guarded movement while preserving DM unrestricted placement.
2. Same-level links: current takeLink chooses the endpoint nearest the party, not the clicked marker. Marker handler only passes link ID. Clicking the far-end marker may resolve the opposite direction from its label. Production directions at their own endpoints are covered by existing tests, but remote marker semantics are not. Coordinate with marker repair; preserve explicit side in action.
3. Automatic overlapping trigger zones still choose the first eligible array entry. One-hop behavior is intentional and tested; selection among distinct coincident links remains ambiguous. Prefer explicit chooser when multiple routes are available rather than introducing an arbitrary source reorder.
4. Upward dumbwaiter status still says Down the dumbwaiter; equal-elevation marker uses down. Cosmetic direction wording should be handled with marker semantics, not claimed as a destination failure.

No additional code changes, tests modified, commits, release actions, downloads or source uploads were made in this read-only pass. Final integration must retain the six authoring gates and marker/interaction edge cases.

## Exact suppressed endpoint inventory at checkpoint 166259b

These are greedy label-dedup results, not claims that every route is unreachable. No label code changed in the follow-up.

| Scene | Level | Suppressed link | Destination level | Kept nearby link |
|---|---|---|---|---|
| wsc/03-compound | L1 | lk-stair_L1_L2 | L2 | lk-stair_L0_L1 |
| wsc/03-compound | L2 | lk-stair_L2_L3 | L3 | lk-stair_L1_L2 |
| appB/death-house | f1 | lk-dumbwaiter-1-2 | f2 | lk-spiral-1-2 |
| appB/death-house | f2 | lk-spiral-2-3 | f3 | lk-spiral-1-2 |
| appB/death-house | f2 | lk-dumbwaiter-1-2 | f1 | lk-spiral-1-2 |
| appB/death-house | f2 | lk-dumbwaiter-2-3 | f3 | lk-spiral-1-2 |
| appB/death-house | f3 | lk-attic-stair | attic | lk-spiral-2-3 |
| appB/death-house | f3 | lk-dumbwaiter-2-3 | f2 | lk-spiral-2-3 |
| ch07/Q | ground | Q-grand-stair-s | second | Q-grand-stair-n |
| ch07/Q | second | Q14-n-2 | third | Q14-n-1 |
| ch07/Q | second | Q14-s-2 | third | Q14-s-1 |
| ch07/Q | beacon | Q51-Q53 | peak | Q50-Q51 |
| ch13/X | lower | X-library-stair | upper | X-statue |
| ch11/V | f2 | V-lift-2 | f3 | V-lift-1 |
| ch11/V | f3 | V-lift-3 | f4 | V-lift-2 |
| ch06/O | O2L | O-stair-2 | O3L | O-stair-1 |
| ch06/O | O3L | O-ladder | O4L | O-stair-2 |
| ch12/W | cellar | W13 | ground | W12-down |
| ch12/W | ground | W11-down | cellar | W11-up |
| ch12/W | ground | W12-down | cellar | W12-up |
| ch12/W | ground | W9-stair | balcony | W4-up |
| ch04/K | dungeon | lk-k85 | dungeon | lk-k85 |
| ch04/K | larders | lk-k21-gr | ground | lk-k21-dun |
| ch04/K | ground | lk-k20a | larders | lk-k20-court |
| ch04/K | ground | lk-k21-court | court | lk-k21-gr |
| ch04/K | ground | lk-k64-court | court | lk-k64-gr |
| ch04/K | ground | lk-k83-court | court | lk-k83-gr |
| ch04/K | ground | lk-k34-ladder | court | lk-k20-court |
| ch04/K | landing | lk-k19-w | court | lk-grand |
| ch04/K | court | lk-k20-weep | weeping | lk-k20-court |
| ch04/K | court | lk-k21-weep | weeping | lk-k21-court |
| ch04/K | court | lk-k18-weep | weeping | lk-k18-court |
| ch04/K | court | lk-k64-weep | weeping | lk-k64-court |
| ch04/K | court | lk-k83-weep | weeping | lk-k83-court |
| ch04/K | weeping | lk-k20-spires | spires | lk-k20-weep |
| ch04/K | weeping | lk-k21-top | spires | lk-k21-weep |
| ch04/K | weeping | lk-k18-spires | spires | lk-k18-weep |
| ch04/K | spires | lk-k20-st | south-tower | lk-k20-spires |
| ch04/K | spires | lk-k18-st | south-tower | lk-k18-spires |
| ch04/K | spires | lk-elevator | larders | lk-k21-top |
| ch04/K | south-tower | lk-k20-roofs | tower-roofs | lk-k20-st |
| ch04/K | south-tower | lk-k48-roof | tower-roofs | lk-k48-st |
| ch04/K | south-tower | lk-k18-roofs | tower-roofs | lk-k18-st |
| ch04/K | tower-roofs | lk-k20-peak | north-peak | lk-k20-roofs |
| ch04/K | tower-roofs | lk-k18-np | north-peak | lk-k18-roofs |
| ch04/K | north-peak | lk-k60a | north-roof | lk-k20-peak |
| ch04/K | north-peak | lk-k18-nr | north-roof | lk-k18-np |
| ch04/K | north-roof | lk-k18-hp | high-peak | lk-k18-nr |
