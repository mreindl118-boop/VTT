# Authored landing geometry for 0.3.2

2026-10-14. ChatGPT, continuing item 2e. Root assigned only the Castle, Abbey, Tsolenka and Raven River generators, their scene/grid pairs, `tests/landing-geometry.test.ts`, and this report. E5 remains root's separate authoring task. Cloud owns transition dispatch, marker choices, visibility and reload. No app-code changes, full build, GPU run, commit, release or publication were performed by this lane.

Initial baseline: `37ae2ff`, with reviewed shared wall implementation `832897a`. Root cleared generated-output writes after its checkpoint. The cloud ownership packet was read at `f1b632e4f915f32956cf9c181a0b89ae558ea412`; its candidate coordinates were treated as diagnoses, not accepted source measurements.

## Initial implementation

| Site | Cause | Authored correction |
|---|---|---|
| Castle `lk-k51` | The lower closet was wholly south of the upper room. The hatch endpoints differed by seven feet; simply moving the upper point into its floor would increase the offset. | Reconstruct the bounded K49-K56 arrangement using the explicit source relationships: K50 has west/east doors, its east door enters K51, and K51 lies below the northeast hatch of K55. Both endpoints and the hidden upper hatch are now `[210,240]` feet. Lower K49/K50/K51 and upper K55/K56 partitions, adjoining doors and their affected fixtures move together. K54 and the stair centre remain registered. The existing 130/150-foot level datums and ten-foot closet ceiling remain; this does not resolve the previously recorded castle elevation-caption conflicts. |
| Castle K22/K28 | Strict wall generation exposed a K22 door through the middle of a room and a K28 aperture with no supporting partition. | K22's door now occupies its shared north-access-hall edge; repeated turret floors use the same edge. K28 retains its intended paired-door coordinates, supported by an explicit partition separating the balcony from its entry/stair bay. Strict aperture consumption remains unchanged. |
| Tsolenka `T-stair` | The final flight ends alongside an uninterrupted diagonal rail, outside the upper floor. | Keep both stair runs and their total 20-foot rise. Add a stone head landing joining the actual flight top to T5, split the real rail at that opening, and place arrival on the upper side at `[255.5,357.5]`. The surrounding rail remains. |
| Raven `R-ledge-steps` | An approximate inset floor stopped before the existing rendered shelf steps. | Derive the walkable shelf crown from the deterministic production shelf shape. Register the head/foot to its existing five cut steps and add a visible four-foot-wide stone cap joining the full-height tread to the crown. Keep the twelve-foot rise. |
| Raven `R-shelf-climb` | The old climb head was more than 23 feet outside the tapered declared floor. | Use the actual west shelf crown edge: head three feet inward, foot four feet outward, a seven-foot plan run with the existing twelve-foot climb. This is the existing authored rock scramble, not a source-specified stair. |
| Abbey `lk-road` | The arrival is on the rendered road/ledge but absent from the walkable grid. | Include the same rendered ledge polygon and ROAD_N/ROAD_E strips in the ground collision floor. No cliff bounding rectangle or endpoint relocation. Existing door and curtain blockers remain. A newly exposed movement-core issue is retained below. |

## Source and coordinate interpretation

Authorized local source pages were inspected as page images: Castle maps 3/4/6/7 on printed pages 55, 62, 71 and 73, plus Tsolenka's plan on page 158. Relevant Castle narrative on printed pages 70-72 supplies the west/east guest-room doors, closet hook/ceiling, vertically related trapdoor and K55 northeast-corner relationship. The existing source ledgers for T, S10 and R were also read.

Castle's isometric plates are not a precise orthographic coordinate survey. The new tower partitions are an explicitly authored rectification that enforces those source relationships within the existing approximate tower footprint; their exact numerical widths are not claimed as printed measurements. Root explicitly authorized this bounded reconstruction after the conflict was reported. The source-supported relationships, physical registration and inferred coordinates are distinct claims. Castle-wide plan accuracy and the known elevation conflicts remain outside this five-landing correction.

Raven's shelf geometry and access are an accepted encounter-map adaptation: the book supports the crossroads/river context, not these exact shelf dimensions. The correction follows the existing rendered crown and step dimensions, rather than presenting new coordinates as canon. Tsolenka's upper landing is a small physical completion of the printed internal stair; bridge span and regional approaches are untouched. Abbey's ledge remains at the existing source-supported 400-foot datum.

No book text or art is added to tracked files. Local rendered source pages and diagnostics stay under ignored `evidence/landing-source`.

## Failing-first and focused verification

`tests/landing-geometry.test.ts` uses the actual generated floors, walls and production `canWalk`/`moveBlockers` functions. The initial six tests failed on the untouched data: all five landing cases plus hatch registration. A separate generator red run records the strict K22 unsupported-aperture exception before correction.

After initial implementation, those six original tests pass. The expanded suite has **15 tests: 14 passing, one failing integration gate**. Checks cover both endpoints, five-foot departure and reverse movement, exact hatch/room registration and preserved hidden state, guest-room west/east doors, closed/open Castle doors, the actual Tsolenka stair mesh endpoint and rail passage, actual Raven shelf raycasts or its rendered cap, and Abbey cliff exclusion. No existing test or threshold was weakened.

All four generators were rerun after the initial successful generation. SHA-256 hashes for all eight output files were identical across the repeated runs. The new Raven stone cap overlaps the rendered-crown floor by 26.040 square feet; it is connected support, not a detached arrival island. `git diff --check` passes for the owned authoring/test/report files.

The initial remaining failure was `ground-S10-doors blocks while closed and permits a reversible passage when open`. Door endpoints are `[150,130]` and `[157.5,137.5]`; the near-side probes are approximately `[151.982233,135.517767]` and `[155.517767,131.982233]`. Production `canWalk` returned true with the door closed on the complete authored ground floor. A diagnostic breadth-first search using strict segment intersections found no such route. The production intersection predicate excluded path-endpoint hits, allowing lattice nodes on diagonal walls to step onto and off a blocker. Root accepted this as a separate all-map movement-core assignment. The real ledge and assertion are retained; this lane did not mask it by deleting legitimate floor or editing unowned movement code.

After the movement lane's initial correction, an unchanged rerun of this entire focused suite passes **15/15**, zero failures (`landing-geometry-core-green.log`). That independent core implementation still requires its own two reviews and permitted fix pass; this result does not prematurely sign it off. The optional local Castle CPU plan diagram was inspected; it is geometry evidence, not a browser screenshot.

Evidence files (local only): `landing-geometry-red.log`, `landing-castle-aperture-red.log`, `landing-geometry-initial-all.log`, `landing-geometry-focused.log`, and `landing-idempotence.log`. Exact runtime pointer/touch, Players marker actionability, save/reload, hardware GPU, screenshot inspection, cost comparison and integrated CI remain root/cloud integration gates. CPU movement and mesh checks do not certify those interactions.

## Identity and integration implications

- Existing room, link and object IDs are retained. `T5-landing` and Raven's `bench-ledge-head` are new physical support geometry. Existing link IDs/kinds and level IDs are unchanged.
- Castle's secret hatch moves from lower `[190,263]` / upper `[190,256]` to shared `[210,240]`. K49/K50/K51/K55/K56 floor ownership and several fixture coordinates change. Saved tokens retain their coordinates; an old token in the removed closet footprint can be outside the corrected floor. Root must address saved-position compatibility or explicitly establish the recovery behavior before release. No save migration is claimed here.
- Reviewed shared `authorlib.py` normalization contributes unrelated wall-list changes when these four generators are regenerated. Stable authored door/secret IDs remain; generated anonymous normal-wall IDs can change. Root owns the final generated diff and all-map state checks.
- Castle exterior massing is outside this lane's file ownership. Root must regenerate/review `ravenloft-exterior.py` after accepting the new upper-floor outlines, then reconcile atlas/J-K placement separately.

## Review gate

The initial record above is historical. Two independent reviews (`wall_review_correctness`, `wall_review_regressions`) and the single consolidated correction pass completed before the outage. Final focused suite: **19/19 passed**, including production rock/cap raycasts at both Raven endpoints, reversible departures, Castle door states and stair access. K/R repeat generation leaves all eight owned outputs unchanged. No full build, GPU run or release approval is claimed here.

Final Raven foot `[259.3,67.6]` clears the rendered rock (reviewed old foot was buried 6.703623 ft); head `[270.9,53.3]`, horizontal run 18.413310 ft, rise 12 ft. Castle K54 is west of K56; K48 stays registered at `[202.5,225]` and upper key `K48-t` is retained. Shared hatch is `[210,257.5]`; old K51 `[190,260]` / `[190,263]` now lie in K50 and require semantic save migration.

Root integration gates: corrected tower rooms extend to z272.5 while old K57 roof ends at z255; reconcile the roof and exterior. Run the Abbey's `krezk-village.py` postprocessor and restore **62** valley `kz-*` objects (the old log's trailing "63" was a diagnostic typo). Complete reviewed save compatibility, integrated build/units/runtime/visual/GPU/cost checks and final reviews. Report recovery does not consume another correction pass.
