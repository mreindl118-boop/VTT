# Additional source-review suggestions

Reviewed snapshot: `f615be1d92d5b7a8c31adc4f7808a422644fe55d` (2026-10-12 UTC). Every item below is **pending Claude's independent verification and Matt's approval or denial**. Source evidence describes this snapshot; proposed runtime checks have not been run.

The earlier fourteen audit suggestions remain in [chat gpt suggestions](../chat%20gpt%20suggestions/README.md), with existing decisions recorded in [QUEUE.md](../docs/QUEUE.md). Those approvals apply to their recorded scope. This document adds evidence and proposals for review; queue references indicate overlap, not a request to reorder work.

| ID | Suggestion | Decision |
|---|---|---|
| G01 | Roll the intended roster when initiative selection is empty | Pending |
| G02 | Preserve the active combatant when removing another creature | Pending |
| G03 | Use the coverage origin consistently for coarse fog | Pending |
| G04 | Keep walking segments over walkable floor | Pending |
| G05 | Confirm travel time at exact eight-hour boundaries | Pending |
| G06 | Prevent site builders from overwriting one another | Pending |
| G07 | Give clipped shells their own materials | Pending |
| G08 | Restore ground mist after switching it back on | Pending |
| G09 | Move locked-door decoration with the door leaf | Pending |
| G10 | Preserve the Tower's world-map link through regeneration | Pending |
| G11 | Match authoring boundary overrides to emitted wall segments | Pending |
| G12 | Retry failed OCR pages on a later run | Pending |
| G13 | Make the grid occlusion check meaningful | Pending |
| G14 | Detect authored doors that disappear during generation | Pending |
| G15 | Emit interior counters and railings as actual geometry | Pending |
| G16 | Leave the Castle's authored entry passages open | Pending |
| G17 | Preserve geometry metadata when reusing the church scene | Pending |

## G01: Roll the intended roster when initiative selection is empty

**Status:** Pending.

**Evidence and impact:** [app/src/ui/encounter.ts:65](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/ui/encounter.ts#L65) checks `inits.size === 0` inside the roster loop. Adding the first sheet makes the map nonempty, so the remaining unselected sheets are skipped. Clicking Roll with no selections therefore adds only the first roster member.

**Suggestion:** Capture whether the selection was empty before iterating, or agree on explicit empty-selection behavior.

**Checks for Claude to run if approved:** Check an empty selection, one/multiple selected sheets, an empty roster, and selected placed creatures.

**Existing work:** Related to queue item 13; this specific failure is additional evidence.

## G02: Preserve the active combatant when removing another creature

**Status:** Pending.

**Evidence and impact:** [app/src/app.ts:851](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/app.ts#L851) filters the initiative order but keeps the numeric turn index unless it becomes out of range. With [A, B, C], B active at index 1, and 10 feet spent, removing A makes C active at index 1 and leaves B's spent movement attached to the turn.

**Suggestion:** Retain the active token's identity when removing another participant. Define advancement and movement reset when the active participant is removed.

**Checks for Claude to run if approved:** Remove a participant before/after the active one and remove the active one; assert active identity, movement, turn, and round.

**Existing work:** Related to queue item 13.

## G03: Use the coverage origin consistently for coarse fog

**Status:** Pending.

**Evidence and impact:** [app/src/core/coverage.ts:39](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/core/coverage.ts#L39) indexes relative to the map origin, and vision evaluates origin-relative cell centers at line 96. Polygon stamping at lines 54–58 and brushing at 74–78 instead use a lattice anchored at world zero. Vallaki has origin [56,746] and 10-foot cells; the Village of Barovia has origin [-234,-187] and 2-foot cells. These positions do not align with that zero-anchored lattice.

**Suggestion:** Iterate map indices and test the same origin-relative centers for masks, polygon stamps, and brushes.

**Checks for Claude to run if approved:** Use aligned and misaligned origins across supported cell sizes. Proposed small fixture: CoverageMap(1,1,2,2,2), reveal rect(1,1,2,2); the cell centered at [2,2] should be revealed.

**Existing work:** Related to queue items 2 and 5. Distinct from the prior repeated-exploration dilation finding.

## G04: Keep walking segments over walkable floor

**Status:** Pending.

**Evidence and impact:** [app/src/core/movement.ts:28](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/core/movement.ts#L28) attaches endpoints to floor nodes using wall checks, without checking whether the connecting segment stays on floor. Traversal at lines 49–52 has the same omission. Proposed separated-floor example: rect(0,0,5,5), rect(8,0,5,5), no walls; from [3.75,1.25] to [8.75,1.25]. The attachment can connect across the three-foot gap despite the module's documented walking contract.

**Suggestion:** Require attachment and traversal segments to remain within the walkable floor union, with explicit rules for permitted crossings.

**Checks for Claude to run if approved:** Separated/adjoining floors, concave boundaries, narrow corridors, and open/closed doors. Runtime occurrence on authored maps has not been measured.

**Existing work:** Relevant to gameplay/range work; confirm the intended movement rule before implementation.

## G05: Confirm travel time at exact eight-hour boundaries

**Status:** Pending.

**Evidence and impact:** [app/src/main.ts:179](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/main.ts#L179) uses floor(h/8)*24 + (h%8). Exactly eight walking hours advances the clock by 24 hours, and exactly sixteen by 48; the clock is advanced with this result at line 213. This includes a rest after the final full travel day.

**Suggestion:** If rest belongs only between travel days, use that convention consistently; for nonnegative h, one candidate is h + 16*max(0,ceil(h/8)-1). Matt should confirm the intended convention.

**Checks for Claude to run if approved:** Check 0, 7.5, 8, 8.5, 16, and 16.5 walking hours and crossing midnight.

**Existing work:** Related to calendar/travel work. The arithmetic is source-confirmed; the preferred convention is a user decision.

## G06: Prevent site builders from overwriting one another

**Status:** Pending.

**Evidence and impact:** [app/src/kit/sites/index.ts:2](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/kit/sites/index.ts#L2) imports Q, S, then X into a shared registry. Q registers divan/candelabra at [app/src/kit/sites/q.ts:443](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/kit/sites/q.ts#L443); S replaces candelabra at [app/src/kit/sites/s.ts:578](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/kit/sites/s.ts#L578), and X replaces divan at [app/src/kit/sites/x.ts:449](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/kit/sites/x.ts#L449). Q6's ground-Q6-divan2 has tipped:1; Q handles it, X ignores dimensions. Q13's floor candelabra resolves to S's tabletop fixture.

**Suggestion:** Use site-specific kind names or intentional shared builders, and reject accidental duplicate registrations. Change the authoring scripts and regenerate affected scenes.

**Checks for Claude to run if approved:** Import the complete site index, then check Q6's tipped state and Q13/S fixture dimensions and placement.

**Existing work:** Related to map/model work. Preserve the generated-scene workflow in COLLABORATION.md.

## G07: Give clipped shells their own materials

**Status:** Pending.

**Evidence and impact:** [app/src/render/materials.ts:217](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/render/materials.ts#L217) caches shared materials and says never to mutate the returned instance, while sectionClip at line 263 sets clippingPlanes on those materials. In Q's roof level, the tower-roof iron finial ([app/src/kit/sites/q.ts:357](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/kit/sites/q.ts#L357)) and stove ([app/src/kit/props.ts:66](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/kit/props.ts#L66)) share the iron material. At a 65-foot section cut on the 60-foot floor, the stove should stay whole under App.applySlider's prop rule, but the finial's clipping plane can cut its pipe, which reaches 68 feet.

**Suggestion:** Use private, correctly fog/grain-patched shell materials for section clipping; avoid leaving clipping on the global palette cache.

**Checks for Claude to run if approved:** Verify the whole stove at a 65-foot cut, the roof's intended clipping, nearby props, and navigation to another map. Shader appearance remains unverified.

**Existing work:** Related to rendering/map work; this is material ownership, separate from the earlier disposal finding.

## G08: Restore ground mist after switching it back on

**Status:** Pending.

**Evidence and impact:** [app/src/render/world.ts:105](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/render/world.ts#L105) assigns mistFloor.visible = on && mistFloor.visible. Once off, turning it on leaves visibility false. The toolbar at [app/src/main.ts:308](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/main.ts#L308) calls layoutChanged/applySlider, which does not restore it; changing floors does at [app/src/app.ts:272](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/app.ts#L272).

**Suggestion:** Derive mist-floor visibility from enabled mist, backdrop presence, and render mode. Check render-mode restoration too.

**Checks for Claude to run if approved:** Indoor on → off → on without changing floors; outdoor backdrops; return from the floor-mask render mode.

**Existing work:** A narrow rendering correction; browser appearance has not been reproduced.

## G09: Move locked-door decoration with the door leaf

**Status:** Pending.

**Evidence and impact:** [app/src/render/build.ts:173](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/render/build.ts#L173) adds a locked-door colored band directly to wallsGroup, while only the leaf is stored in the doors map. [app/src/app.ts:575](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/app/src/app.ts#L575) toggles the stored leaf, leaving the band behind. Authored example: T4-door in [locations/ch09/T/scene.json:673](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/locations/ch09/T/scene.json#L673).

**Suggestion:** Make the leaf and its decorations one controlled group while retaining the frame.

**Checks for Claude to run if approved:** Open/close T4-door as DM and restore its persisted open state; verify the leaf and band change together.

**Existing work:** A narrow visual correctness suggestion; no screenshots were taken.

## G10: Preserve the Tower's world-map link through regeneration

**Status:** Pending.

**Evidence and impact:** [scripts/authoring/wire-sites.py:25](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/scripts/authoring/wire-sites.py#L25) rewrites the generator with a regex matching single-quoted pin names. [scripts/authoring/barovia-world.py:36](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/scripts/authoring/barovia-world.py#L36) uses a double-quoted name for V and an empty scene list. Current world.json has V → ch11/V, but the generator's record does not retain that link. Regeneration can drop it.

**Suggestion:** Use structured shared pin metadata, or a robust update that detects failed matches and preserves intended scene links.

**Checks for Claude to run if approved:** Regenerate the regional world, apply normal follow-up steps, and assert every built pin keeps its intended scene paths, including V.

**Existing work:** Related to the existing asset pipeline. Regeneration has not been run in this review.

## G11: Match authoring boundary overrides to emitted wall segments

**Status:** Pending.

**Evidence and impact:** [scripts/authoring/wsc-town.py:144](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/scripts/authoring/wsc-town.py#L144) records whole octagon-edge overrides for an open square. [scripts/authoring/authorlib.py:21](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/scripts/authoring/authorlib.py#L21) splits axis-aligned room edges into unit segments, and build_walls at line 120 matches those segment keys exactly. Current WSC street output retains normal walls along those intended-open sides. The same mechanism affects X23's broken balcony through open_seg ([scripts/authoring/amber-temple.py:286](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/scripts/authoring/amber-temple.py#L286)), with retained walls upper-w-266 through upper-w-271 in the Amber Temple output.

**Suggestion:** Apply overrides using the same segmentation as wall generation; report unmatched overrides. Change generators and regenerate.

**Checks for Claude to run if approved:** Assert the WSC square's intended perimeter is open, X23's broken balcony stays open, and ordinary walls/doors still match their overrides.

**Existing work:** A generated-map correctness suggestion, relevant to map work. A browser movement/visual check is still needed.

## G12: Retry failed OCR pages on a later run

**Status:** Pending.

**Evidence and impact:** [scripts/ocr.sh:17](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/scripts/ocr.sh#L17) skips every existing nonempty text file. When both OCR attempts fail, line 24 writes a nonempty '[ocr timed out]' marker. A subsequent run treats that failure marker as a completed page and never retries it.

**Suggestion:** Track failure separately or detect the marker; publish successful OCR text atomically.

**Checks for Claude to run if approved:** Stub an OCR failure followed by a later success and verify the page is retried while genuinely successful pages remain resumable.

**Existing work:** Relevant to source-data tooling. No source book was fetched or OCR run.

## G13: Make the grid occlusion check meaningful

**Status:** Pending.

**Evidence and impact:** [e2e/grid.spec.ts:25](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/e2e/grid.spec.ts#L25) asserts outside >= 0 for a nonnegative pixel count. This always passes, although the test describes grid occlusion by walls/props. The comment recognizes ground outside floor polygons is intentionally gridded; the old floor-only mask no longer expresses the intended check.

**Suggestion:** Define the current foreground-occlusion contract and assert against a suitable mask, or revise the test's promise and add a focused occlusion case. Preserve intentional apron grid behavior.

**Checks for Claude to run if approved:** Demonstrate that intentionally drawing grid through a foreground wall/prop fails the check while the current intended ground grid passes.

**Existing work:** Relevant to validation. No test was modified or executed.

## G14: Detect authored doors that disappear during generation

**Status:** Pending.

**Evidence and impact:** [scripts/authoring/vallaki-sites.py:187](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/scripts/authoring/vallaki-sites.py#L187) stamps N3a-front at fractional endpoints that do not match room-edge subdivisions; N4a-front/N4e-back at lines 323/325 have the same problem. Church reuse at lines 539–542 loses the five source door walls; current N1 has zero door walls. N5d-door at line 590 is stamped inside its wagon room rather than on its boundary. Also, [scripts/authoring/castle-ravenloft.py:399](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/scripts/authoring/castle-ravenloft.py#L399) opens an edge before stamping K63-door; the retained open_wall flag makes build_walls skip that door. The referenced IDs are absent from current generated walls.

**Suggestion:** Check that every authored door produces geometry. Match or split boundaries at actual opening endpoints, correct the wagon boundary, and define replacement behavior for conflicting open_wall/door overrides.

**Checks for Claude to run if approved:** Regenerate and assert the named N3/N4/N5/K63 IDs and N1 doors exist, then check closed/locked versus open passage behavior.

**Existing work:** Related to G11 and generated-map work. The distinct caller and override-precedence problems need explicit review.

## G15: Emit interior counters and railings as actual geometry

**Status:** Pending.

**Evidence and impact:** [scripts/authoring/krezk-abbey.py:270](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/scripts/authoring/krezk-abbey.py#L270) calls counter for the L-shaped S20 office counter. [scripts/authoring/authorlib.py:87](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/scripts/authoring/authorlib.py#L87) stores counters/railings only as overrides, while build_walls emits room boundaries and explicit extra walls. An interior segment with no matching boundary is omitted. Current S10 contains no office counter geometry; ground/loft railing calls and WSC stable partitions use the same pattern.

**Suggestion:** Emit explicit interior counter/railing geometry or dedicated objects, and flag orphan overrides. Preserve intended movement blocking and visibility.

**Checks for Claude to run if approved:** Require S20's expected segments, abbey railings, and stable partitions in regenerated output; verify walking and sight behavior.

**Existing work:** Related to generated-map work and G11. No generator was run during this review.

## G16: Leave the Castle's authored entry passages open

**Status:** Pending.

**Evidence and impact:** [scripts/authoring/castle-ravenloft.py:62](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/scripts/authoring/castle-ravenloft.py#L62) opens the postern and line 64 opens the west gate, but lines 68–69 add uninterrupted outer curtain walls. Extra walls bypass boundary overrides in authorlib. Current Castle has ground-x-3 across x=0, z=340→0, and ground-x-1 across x=380, z=0→340, crossing both intended passages.

**Suggestion:** Split explicit curtain walls around the intended gate/postern openings.

**Checks for Claude to run if approved:** Assert the west passage near z=170 feet and the east postern near z=165 feet intersect no closed normal wall; verify surrounding curtain-wall geometry remains.

**Existing work:** Related to the approved Castle completion/map work; independently check current in-progress Castle changes first.

## G17: Preserve geometry metadata when reusing the church scene

**Status:** Pending.

**Evidence and impact:** [scripts/authoring/vallaki-sites.py:544](https://github.com/mreindl118-boop/VTT/blob/f615be1d92d5b7a8c31adc4f7808a422644fe55d/scripts/authoring/vallaki-sites.py#L544) copies object kind, x/z position, and rotation from E5 into N1, omitting dimensions and local elevation. Comparing current JSON finds 23 copied objects with source dimensions missing from the N1 copy, including eight benches authored at eight feet and explicit candlestick heights. They fall back to default geometry.

**Suggestion:** Retain applicable geometry fields with explicit, documented site-specific exceptions.

**Checks for Claude to run if approved:** Compare dimensions, local elevation, and rotation for retained source/copy objects, then inspect the intended N1 arrangement.

**Existing work:** Related to generated-map work. Confirm which differences are intentional before changing them.


After reviewing an item, please bring the applicable proposal to Matt, record his decision, and implement only approved scope. The source analysis does not establish browser timing, iPad appearance, performance, or a tested fix. See [COVERAGE.md](COVERAGE.md).
