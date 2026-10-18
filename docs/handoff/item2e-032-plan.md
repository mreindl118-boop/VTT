# Item 2e: comprehensive map logic for 0.3.2

Prepared 2026-10-14. This is an implementation plan and sanitized continuation brief, not a test result or release approval.

## Authority, baseline and completion rule

Matt authorized comprehensive map-logic correction for 0.3.2, overnight progress with independently assigned agents, and a cloud fallback if the laptop becomes unavailable. Item 2e in `docs/QUEUE.md` records this scope. Keep the bounded 0.3.1 release separate; independent 0.3.2 preparation and implementation may proceed on assigned isolated branches while its checks run. Merge the final 0.3.1 release ancestor into the integration history before releasing 0.3.2. The integration owner remains the root task while online; only the parent assigns fallback takeover scope.

The starting inventory is **46 production maps: two regions and 44 scenes containing 122 levels**. Curse of Strahd contributes one region and 39 scenes / 113 levels; Sheep Chase contributes one region and five scenes / nine levels. The development fixture is a separate map with two levels. `ch02/encounter-terrain` is a manifest-only kit entry, not a built production map. Added sublevels or missing source rooms must receive new coverage records; do not preserve the number 122 by compressing required heights into an incorrect shared floor.

The source ledgers freeze `785421cb45ad3b7a5467a14f6e696074efb9bd27`. Later continuity work and measurements are separate evidence. The parent reports versioned 0.3.1 candidate `81b02a3cfa6f02af22072f743446c0ca9ed4f8e0` pushed to laptop WIP, with CI run `38510227430` still in progress at this checkpoint. The root's isolated `item2-map-logic-032` branch starts there. The independently assigned cloud transition task starts from `55b118e0b78a89b04d0780dd0c713f0a54632c9c`; that authorized work need not wait for 0.3.1 release checks. Record every branch's exact base and reconcile the final release ancestor before 0.3.2 integration/release.

The corrected Amber implementation `e37734dff30e61ff16ae816ddb294dca4fe46300` and its test acceleration `f9e099cee9997287ad027a8cb498742df2b05205` supersede the earlier Amber mesh failure. Frozen build `index-DSh4mmpD.js`, still labelled 0.3.0, passed 543 units and 267 browser tests, with two existing unit todo entries and 55 existing device skips. The versioned 0.3.1 build `index-CoeOhM3n.js` separately passed its build, 543 units and 21 desktop CPU checks; its full browser run is still in progress. Do not transfer a pass between these different build bytes, or treat either as 0.3.2 evidence. Check current exact-head CI before any release action.

Read `AGENTS.md`, `docs/QUEUE.md`, `docs/COLLABORATION.md`, `docs/HANDOFF.md`, `docs/WORLD.md`, the current continuity report and these evidence files:

- `docs/handoff/allmap-audit-inventory.json` and `allmap-audit-report.md`: complete inventory, structural probes, later runtime/source annotations and their limits.
- `docs/handoff/allmap-movement-coverage.json`: door overlaps, raw and snapped landing probes, isolated transition behavior.
- `docs/handoff/allmap-source-ch02.json`: 13 maps / 34 levels / 47 narrative comparisons. Its original lane did not inspect map artwork.
- `docs/handoff/allmap-source-images.md`: later full-page regional/G/T inspections and limited J/K/X locator work. Retain this later evidence instead of treating all chapter-2 source images as uninspected.
- `docs/handoff/allmap-source-structures.json`: five maps / 31 levels / 45 source-plan and narrative comparisons.
- `docs/handoff/allmap-source-remaining.json`: 21 maps / 48 levels / 48 comparisons, with all 18 primary plan pages inspected.
- `docs/handoff/allmap-source-wsc.json`: six maps / nine levels / 15 authored-reference comparisons; publisher-plan confirmation is still incomplete.
- `docs/handoff/item7-open.md` and `item6-map-groups.json`: historical candidates, never proof that a parked correction is present or acceptable in the current app.

All 46 maps have some source or authored-reference evidence. None earns complete certification from a schema pass, one screenshot, a successful nearby move, or a historical branch review. Close each applicable finding as fixed and verified, supported behavior retained, documented source conflict, or an expressly accepted adaptation. A known unresolved physical-logic defect blocks the claim that every map's logic is correct.

## Four separate acceptance records

For every map, and every scene level, keep four independent states. Record exact commit, fixture/build fingerprint, evidence locator, reviewer and remaining limits. Add criterion-level N/A explanations instead of untested green checkmarks.

| Record | Required evidence |
|---|---|
| Implementation | Generator/engine change, failing regression before the fix, passing focused checks, deterministic regeneration and valid geometry. Preserve stable identities or provide saved-state migration fixtures where positions, levels or keys change. |
| Source | Applicable plan plus narrative constraints, printed page/section or authored-reference locator, units and north convention. Separate exact dimensions, approximate descriptions, source contradictions and landscape interpolation. |
| Runtime | Actual fresh entry and existing-save entry; walkable routes, door states, correct stair destination and one transition; parent/child entry and return; wheel/touch zoom both ways; DM/Players behavior and restricted-view regressions. |
| Visual | Inspect desktop 1366x768 and phone 390x844 in DM and Players views. Include wide region/site context, approach, local floor, all affected levels, below/above views where meaningful, and return to wide context. Check water, terrain, foundations, roofs, material seams, grid, proxies and intended hidden spaces. |

Use the existing seven criteria within those records: canonical relationships; transform/elevation/scale; terrain/foundation/underground intent; road access/grade/connectivity; water flow/bridge clearance; biome/material seams; and duplicate/proxy ownership. Region maps have route/water/terrain records rather than fictitious floor levels. Audit every production map even if it has no initial finding.

## Dependency order

### 0. Record isolated bases and assign ownership

The root records current candidate bases, fetches remote refs, checks for newer cloud work and maintains one integration branch. Independent assigned implementation proceeds while the bounded release is verified; once released, merge the final 0.3.1 ancestor and resolve differences before 0.3.2 release. No history rewriting or deletion of parked branches. Use isolated worktrees and disjoint owned files; do not regenerate shared outputs from several lanes at once. Keep the ordinary two-agent laptop limit unless the integration owner explicitly uses Matt's overnight parallelism authority where resources and file isolation permit it. Only one owner runs the GPU suite at a time.

Checkpoint the task matrix before dispatch: task ID, owner, starting SHA, exclusive input/output paths, dependencies, expected tests, progress SHA, review state and next action. Two reviewers per build step and one fix pass remain the default procedure; final correctness, regression/performance and acceptance reviews remain required. Overnight authorization is not an automatic removal of those limits. If a completed fix pass still leaves a blocker, report the exact finding and authority needed for another pass while progressing independent work.

### 1. Establish source and coordinate contracts

Before resizing or repositioning a site, record its source scale, north convention, physical entrances, reference floor datum, room-group dimensions and links to neighboring maps. Define one authoritative world position for each physical structure and explicit proxy ownership. Parent marker bounds, outdoor terrain extent, building envelope and underground extent are different quantities.

Create a consistent height/route constraint graph for each region: source-supported anchors, lake surfaces, river junctions, falls, bridge decks, road destinations and local site interfaces. Record inferred heights separately. Exact source facts outrank old convenience values. Approximate descriptions do not justify an invented universal percentage tolerance. Retain legitimate insets and accepted authored expansions with explicit registration or view semantics.

Source-conflict decisions that affect shared datum contracts precede map edits. Unambiguous components can proceed independently; do not stall unrelated maps while Castle's conflicting tower captions are reconciled.

### 2. Correct shared topology and movement causes

There are at least three separate failure families; tests must distinguish them.

1. **Wall generation.** `authorlib.py` subdivides room edges and stamps overrides by exact segment keys. Different half-cell subdivisions can leave another normal wall behind an opened door. `import-ml.py` also appends standalone doors when no exact room edge matches. The current evidence finds collinear normal-wall overlap at 25 of 28 blocked apertures, including E5, N2, N3, N4, N6 and K74d. Normalize/split coincident edges at shared vertices and aperture ends, preserve protected wall portions, and apply openings to the correct interval. Do not delete an entire wall because part overlaps a door; do not make `canWalk` ignore walls globally. Add assertions for every requested door/secret/window override being consumed, with stable IDs and no unexpected aperture overlap. Handle import paths as well as hand-authored paths.
2. **Entry and landing geometry.** Validate the actual chosen entry and post-snap destination against the intended support surface and collision graph. E5's raw lower endpoint is 8 ft outside its floor; snapping changes that to 7.5 ft. S10's approach is 67.546 ft from its room floor and the runtime probe cannot move. The Sheep Chase square also fails initial movement. V's lift point is over an intentional opening, so repair landing/transfer behavior without filling a legitimate shaft. Nearby-move failure and source-plan mismatch are distinct evidence.
3. **Transition dispatch.** `App.takeLink` currently selects an endpoint and calls a proximity-based loop; `afterPartyMove` can continue evaluating later links after a transition. The isolated 346-activation probe records 56 wrong destinations and 22 multiple transitions. An explicit requested link must select that link/direction exactly once. Automatic entry should select at most one eligible route, avoid immediate arrival retrigger, and preserve conditional/one-way behavior. Test collocated stair/ladder/elevator endpoints, reverse travel, same-level links, inactive/unavailable links and save/reload. Do not merely spread anchors apart to conceal the engine defect.

Use production wall geometry in focused `canWalk` tests, then browser routes. Cover open/closed/locked/revealed-secret states and alternate routes; an open door can still be followed by another legitimate obstacle. Re-run all 365 existing door records, all 173 existing links / 346 directions, and any newly added geometry. Resolve the 47 unprobed door cases by suitable local fixtures or documented applicability, and replace the oversized Berez-grid exclusion with a bounded equivalent that exercises the actual algorithm. Do not label those exclusions passes.

### 3. Solve the connected regional land, water and road model

Work from the contracts in step 1, with shared engine changes integrated before local authors consume them. The baseline survey flags 22 Barovia road fragments above 25% raw grade and 13 river fragments that rise and fall; 25% was a triage threshold, not an approved engineering limit. A later analytic Tsolenka sample reached absolute grades 1.6703 and 1.5883. Do not grade roads by draping them over arbitrary mountain noise.

Represent downstream direction and connected lake/river nodes explicitly. Keep water surfaces and beds separate, preserve positive water depth where required, and keep lake surfaces level. Remove exact duplicate river segments only after establishing their identity and preserving connectivity; baseline pairs [5,10] and [6,11] are identical. Sample water and road profiles along the complete route and on both sides of every local/regional boundary, using the actual rendered triangulation as well as the analytic height function. Retain the corrected hard-cut mesh/wall regressions from 0.3.1.

Choose plausible road length, switchbacks, embankments/cuts and crossing positions while preserving source destinations and supported vertical differences. Record the route class and justified grade envelope; avoid a single invented grade rule for carriage roads, footpaths and climbing routes. A nearest-polyline distance is neither graph connectivity nor an acceptable joined slope. Define shared endpoints, tangent/width continuity and surface-support checks. No new cliff or lake rim should appear solely because a local flattening band ends.

**Tser Falls is the acceptance example for this work.** Establish a credible upstream catchment and channel, crest, descending water, broad open natural gorge, receiving pool and downstream continuation toward G and D. Preserve the upper bridge and north/south road approaches and the low riverside path. The source gives approximately 1,000 ft between bridge and basin; baseline 960 ft is an approximation to assess, not a reason to flatten the gorge. Baseline world datums H pool 336, G water 366.55 and D river 487 ft rise downstream and cannot all survive unchanged. Inspect the whole connected valley, the upstream and downstream reaches, both bridge approaches and the waterfall from distant and local views. A short visible trench with buried continuation fails even if its close-up looks correct. Label unsurveyed landscape shaping as interpolation, with the source-supported locations and dimensions retained. Apply the same connected-context standard to every water/road site in both campaigns.

### 4. Repair local geometry and regenerate in owned batches

After shared wall generation is stable, apply source-backed room/level/roof/stair corrections through each generator. Repair invalid polygons with valid outer rings/holes or explicit disjoint floors; preserve intended voids. Every decorative stair must agree with its actual traversable floor change. Split levels or use an explicitly supported floor-height representation when a single horizontal level cannot express the source. Avoid numeric ceiling changes that only hide an incorrect roof.

Map teams can author local shapes while regional contracts settle, but may not invent independent world datums or patch central atlas files. Shared generators that emit several scenes have one owner, including all emitted outputs. Repeat generation to prove idempotence and inspect the generated diff for unintended campaign-wide changes. Run source-text overlap and terms checks after any descriptions are regenerated.

### 5. Register sites, entrances, foundations and proxies

With authoritative local geometry and regional constraints available, compute root and child placement from physical reference points. Align an actual doorway/threshold and orientation, then verify building envelope and ground contact; whole-apron centering is insufficient. Correct J/K as one connected entrance/castle system, and colocate the Sheep Chase tavern with its adjacent square instead of keeping independent pins one mile apart. Preserve scene identities and saved campaign coordinates through an explicit migration if their meaning changes.

Underground extent beyond the exterior building/apron is legitimate for Castle, Death House, N4, U, W, X and Z. Expose the active interior with correct section/fog behavior while retaining the exterior mountain/building mass in context. Do not turn a mountain-enclosed temple into an open-air excavation as a substitute for visibility logic. Validate support heights for trees, fences, bridge abutments, walls and roof bases against the same final surface used to draw them.

Regenerate the atlas and massing only through the integration owner after each dependent batch. Check both exact rigid transforms and semantic entry/footprint registration. Verify one visible owner per real structure throughout zoom/streaming transitions, including J/M Ravenloft stand-ins; preserve intentional miniature models and alternate-level insets.

### 6. Integrate, inspect all maps and release sequentially

Each independent build step receives two reviews, one bounded correction pass and focused re-verification. Integrate small tested commits, with the required contiguous attribution trailers and branch provenance. The root coordinates generated atlas/massing changes and conflict resolution. New PRs are draft unless the current handoff explicitly authorizes another state.

After all batches, the final three lenses are: (1) source and physical-logic correctness, (2) regressions, saved-state compatibility and performance, (3) owner acceptance across all map/level/device/view records. Retain Death House, Vallaki and Sheep Chase square regressions, plus the full H-G-D water journey, R-T-X road journey and J-K entrance journey. Full phone tuning and expanded Player Display remain separate queue work, but regressions caused by 0.3.2 must be fixed.

Run build, units, generator/outdoor checks, required repeated checks for any reused components, the unchanged complete browser suite and fresh exact-head CI. Preserve the whole-valley 300,000-triangle test and every other existing assertion; it is not a universal per-scene triangle limit. Compare draw calls/frame time and five warmed streaming round trips against the release base. Software-rendered cloud tests are useful but do not replace an explicitly required GPU run or physical-device claim. Serve an immutable build with its fingerprint during verification; do not rebuild under the running suite.

Root then reconciles fresh main, applies version 0.3.2 consistently to both package files, writes the dated plain-language changelog and updates Help/queue/handoff/status. Re-run versioned release checks and exact CI before merging/pushing the release branch. Public compiled desktop bundle/feed distribution is still held. App and screenshot publication remain separately owned under `AGENTS.md`; this plan does not authorize publishing source art or screenshots.

## Assigned and proposed independent ownership areas

Cloud task `01a13894-97b1-7226-881c-4da050fb00d0` is prepared and explicitly owns item11's transition-dispatch and arrival-movement correction plus narrow tests. The parent confirms its baseline build, units and desktop checks pass, SwiftShader is available, and its 346-transition probe reproduced the failure. This confirms useful independent work is active; it does not grant shared-file takeover on a timeout. Root owns regional terrain, hydrology, placement and integration/release. The other rows are proposed boundaries for explicit assignment, not simultaneous grants to edit every listed file. Each owner reports dependencies before touching another area.

| Task | Exclusive implementation area | Dependencies and output |
|---|---|---|
| CORE-NAV — assigned cloud | Transition/arrival portions of `app/src/app.ts` and `app/src/core/movement.ts`, narrow movement/transition tests | Cloud task above has exclusive transition-dispatch and arrival-movement work. Root/local agents must not overlap. Request a coordinated ownership extension before other edits to shared app/grid APIs; root serializes integration. |
| GEN-TOPO | `scripts/authoring/authorlib.py`, shared wall tests; coordinated changes to import door splitting | Own shared topology API. E5/import and map owners consume it after a contract checkpoint. Do not run unrelated import generations without their owner. |
| REGION | `heightfield.py`, `barovia-world.py`, regional cover/continuity survey generators; both regional `world.json` outputs | One owner for connected river/road constraints. Sheep Chase scene owner proposes graph anchors but does not independently rewrite its region. |
| TERRAIN | `app/src/core/siteInterfaces.ts`, `terrain.ts`, relevant `app/src/render/backdrop.ts` and terrain mesh tests | Root owns analytic/rendered height agreement, local seams and excavation support unless explicitly delegated. Confirm exact terrain module in fresh tree. Coordinate any app/grid API dependency with CORE-NAV before editing. |
| WILD | `wild_a/b/d/f/h/i/j/l/m/p/r.py`, `wilderness.py`, `wildlib.py`, their chapter-2 scenes | Integrate REGION contracts; Tser catchment/outlet and H/G/D continuity are one acceptance batch. G's import/camp generator changes are coordinated with IMPORT. |
| VALLAKI | `vallaki-sites.py`, `vallaki-square.py`, `vallaki-town.py`, N/N1-N9 outputs | One owner because one script emits multiple children. Depends on GEN-TOPO; authoritative sizes precede town-model registration. |
| IMPORT-VILLAGE | `import-ml.py`, `village-map.py`, `village-roads.py`, E/E5 outputs and coordinated C/G seed-derived updates | Requires ignored input extracts or a separately reviewed replacement authoring recipe. Declare every output before running the importer. |
| CASTLE | `castle-ravenloft.py`, `ravenloft-exterior.py`, K outputs | Reconcile tower convention, missing spaces and J entrance contract. Coordinate J changes with WILD; root integrates shared registration. |
| HOUSE-Q | `death-house.py`, `argynvostholt.py`, their scene/grid outputs | Independent generators; may split into two owners. Preserve supported dimensions while fixing shafts, exterior rises and roof opening. |
| KREZK | `krezk_land.py`, `krezk-village.py`, `krezk-abbey.py`, S/S10 outputs | One owner for +400 shelf, road geometry and child datum; depends on REGION/TERRAIN/NAV interfaces. |
| HIGH-SITES | `tsolenka-pass.py`, `amber-temple.py`, `werewolf-den.py`, T/X/Z outputs | Can split by generator after shared contracts. Kit changes in `t.ts` serve T and Z and require a single designated owner. |
| WEST-SITES | `berez.py`, `creeping-hut.py`, `van-richten-tower.py`, `wizard-of-wines.py`, `yester-hill.py` and outputs | Can split by generator. V valid holes/landings depend on NAV; Y/X parked component adaptation depends on source height decisions. |
| SHEEP | `import-mapset.py`, `wsc-town.py`, `noke-tower.py`, five WSC scene outputs and location manifest | Preserve accepted stone tower/tavern adaptations. REGION owns `wsc/00-region/world.json`; prevent importer from erasing land or rewriting unrelated outputs. |
| INTEGRATION | `scripts/world-atlas.ts`, `scripts/world-massing.ts`, central manifests, shared schema/save changes, version/changelog/queue/handoff | Root only. Also arbitrate shared kit/material files, test fixture changes and per-map completion ledger. |
| REVIEW | Read-only source, CPU/runtime or visual lanes with explicit criteria | Review exact immutable SHA/build; no build edits or GPU competition. Store private visual evidence outside Git. |

`old-bonegrinder.py` belongs to an explicitly assigned local-map owner, normally HIGH-SITES or IMPORT-VILLAGE; it must not fall between batches. Assigning more agents cannot make central authoring, app dispatch, region data or GPU verification concurrently writable.

## Complete production map checklist

Page numbers below are printed CoS pages. Detailed JSON relation IDs and field locators remain the authoritative audit evidence. Every row also receives all applicable acceptance checks above. Counts are baseline levels, not a requirement to retain a flawed level grouping.

| Map | Levels | Concrete work and source/reference constraints |
|---|---:|---|
| `ch02/barovia-region` | region | Establish coherent basins, directed rivers, road graph and site interfaces; remove verified duplicate segments. Regional map p35; inventory regional profiles. Preserve later G/T source-image evidence. |
| `ch02/A` | 1 | Road/forest support and A-to-B journey; p33. Baseline straight-line pin gap 0.729 mi does not explain the described travel duration; do not infer speed from pin distance alone. |
| `ch02/B` | 3 | Eastern detailed gate and western B2 proxy retain two real sites; pp33-34. Verify open/closed leaves, road axis, thresholds and both gate routes. |
| `ch02/C` | 1 | Add the missing spatial body/clue encounter about 15 ft off the road in original wording; p34. Preserve any generic encounter utility and connect gates to village. |
| `ch02/D` | 3 | Ivlis crossing/channel/bed, 5-10-ft water depth and roughly 50-ft width; p35. Repair invalid polygons/landings and join H-G-D downstream. |
| `ch02/F` | 4 | Preserve NW descent toward G and SW climb toward H, five-foot gallows platform and eleven grave representations; p35. Verify all branch joins and level landings. |
| `ch02/G` | 1 | Retain corrected north shore; add northbound riverside path toward H and source composition: five small tents plus large tent, four wagons, eight horses; p36 plan/narrative. Fit source-scale pool into regional flow. |
| `ch02/H` | 3 | Full upstream-to-downstream falls system and wide open landscape; p37. Approximate 1,000-ft bridge-to-pool relationship, high road and low path; preserve conditional climbing intent. |
| `ch02/I` | 2 | Eastern castle branch, NW gate branch, southern H branch; pp37-38. Repair invalid terrain and prove joins; preserve east-facing carriage staging and its conditional reveal. |
| `ch02/J` | 3 | Direct K entrance, 50-ft gap, 90-ft court walls and approximately 1,000-ft cliff relationship; p38, pp52-54. Resolve 4,598.45-ft pin gap and 583.815-ft datum mismatch, retaining one castle owner. |
| `ch02/L` | 2 | Same regional/local lake surface and shoreline; p38. Preserve three beached boats and fourth about 400 ft out (measured 400.351 ft from actual shore). |
| `ch02/M` | 4 | Mountain ascent and hidden uphill entrance; p39. Approximately 60-ft encounter separation versus 78.87-ft plan / 82.74-ft spatial measurement needs a stated interpretation. Retain intentional illusion figures; no second Ravenloft. |
| `ch02/P` | 3 | Four-way junction, rising NW branch, descending SE Berez route, V connection; p40. NE bridge route is about 1,050 ft versus approximate quarter-mile description; reconcile without arbitrary tolerance. |
| `ch02/R` | 4 | Connect all five named branches and northern bridge; p40. Winery/tower paths must continue beyond skirt. Repair five invalid polygons and landing candidates; qualify local 16-ft deck/water separation. |
| `ch03/E` | 1 | Preserve 40-ft source-grid trace, keyed village and churchyard; pp42-45. Register E5/Death House by actual entrances, with connected roads and supported buildings. |
| `ch03/E5` | 2 | Hall 10x20 ft, chapel/apse source shape, 15-ft lower descent and earth undercroft; pp45-47. Fix 8-ft raw landing miss and overlapping door walls through generator. |
| `appB/death-house` | 6 | Preserve floors 0/10/22/30 and ceilings 10/12/8/13 ft, 30x55-ft house and north=-x; pp212-220, map216. Register attic shaft (57.08-ft xy error), den trapdoor (60.13 ft), lower stair panels (66.57 ft), 20-degree approach and two-foot basin. |
| `ch04/K` | 12 | Correct floor/shaft/room constraints and model required missing crypt interiors/vaults; maps53/55/62/65/71/73/75. K34 ladder must rise20, K79/K83 route rises70, K77 is10 above K76; K20/K57/K60a diameters60/60/20. Record tower-source conflicts before datum changes. |
| `ch05/N` | 1 | Three gates, town trace and child plot/door registration; pp95-97. Source wall15 and staging12 ft; authored palisade height16.5 needs reconciliation. Avoid broad flat apron and overlapping context houses. |
| `ch05/N1` | 1 | Reused church without E5 undercroft; pp46,97-98. Crypt10x10x5; correct inherited plan and 121.64-ft building-center/parent-marker offset candidate. Preserve object dimensions during copy. |
| `ch05/N2` | 3 | Source guest rooms15x15, corridor20 long, attic10x35 with8-to5-ft sloping ceiling; pp99-103. Correct hatch shifts17.68/45.07 ft, loft void, doors, roofs and parent envelope; preserve +15 balcony. |
| `ch05/N3` | 3 | Correct N3m/N3q placement, N3r20x20 chamber and attic ladder registration; pp104-109. Preserve +20 main upper floor and distinguish inferred attic datum from explicit roof peak20. |
| `ch05/N4` | 3 | Correct N4n/N4q placement and hidden store10x10; pp110-114. Preserve upper+15 and two cellar entrances; lower depth is inferred. Fix door overlaps and underground visibility. |
| `ch05/N5` | 1 | Stockyard/warehouse/wagon relationship; pp97,115-116. Exact no-plan layout is authored expansion: correct physical access/roof/placement without claiming a canonical resize. |
| `ch05/N6` | 2 | Restore five-foot plan scale: source outline about35x55 versus current90x145; pp116-118. Roof36x58 is undersized for current floor. Retain room adjacency and fix doors and stair landing. |
| `ch05/N7` | 1 | Preserve documented authored toy-shop/workshop layout; pp97,118-119. Correct context envelope, entry and roof support without inventing a source floor plan. |
| `ch05/N8` | 1 | Restore central fountain/west-facing statue and northern stocks; p119. Retain documented N8a-d shop additions with valid access and parent placement. |
| `ch05/N9` | 1 | Ten-foot printed grid, 30-ft hill, tent/ring above homes, twelve wagons rather than14; pp119-122. Preserve north=+x and correct atlas quarter-turn. |
| `ch06/O` | 4 | Eastern wall stair arc, tapered mill and supported promontory/road; pp125-128, map127. Preserve stated8/8/9-ft ceilings; floor spacing is inferred. Four NW megaliths remain. |
| `ch07/Q` | 6 | Preserve 0/20/40/60/80 hierarchy; maps131/137, pp130-142. Correct northern10-ft exterior rise, cemetery approach and Q43 hole alignment (10-ft xy shift). Q53 roof30 versus competing level/prop values needs reconciliation. |
| `ch08/S` | 3 | Preserve20-ft walls and400-ft abbey rise; pp143-148, map144. Lengthen/shape credible switchback and connect NE mountainside to region; fix foundation support without reducing canonical height. |
| `ch08/S10` | 5 | Correct default approach/entry and connected court/wing routes; maps149/153. Preserve hall50x50 core plus entrance projection, barracks30x30, loft+20/cellar-20/walk+15 relative to court. |
| `ch09/T` | 4 | Preserve 0/20/30/40 levels, north=-x and10-ft grid; pp157-159/map158. River500 below deck; roof540 above valley. Bridge70-ft deck plus two10-ft passages can satisfy90 total. Fix upper landing and all gorge/road continuations. |
| `ch10/U` | 2 | West-bank ruins, east-bank stone circle and north riverside entry; pp161-165/map164. Cellar30x30/ceiling10, three-inch water; twelve menhirs at50-ft radius and15-18-ft heights. Preserve submerged/marsh intent. |
| `ch10/U3` | 2 | Hut15x15 and east doorway above stump/roots; p163/map163, p226. Exact+10 floor and ceiling8 are inferences. Keep parent center and three-foot hidden cavity intent; no duplicate hut. |
| `ch11/V` | 4 | Four20-ft storeys and vertical lift shaft; pp167-171/map170. Valid floor holes and usable lift landings; preserve causeway about300 ft (clipped geometry305 ft). Resolve source scaffold ambiguity explicitly. |
| `ch12/W` | 4 | Preserve10-ft vat balcony then5-ft climbs to upper15; pp173-179/map175. Correct W16 polygon while retaining registered10x10 hoist hole; support ramp/spiral, cellar and vineyard road. |
| `ch13/X` | 3 | Preserve +40/+30/0, mountain enclosure, southern facade and west fissure; maps182/190. X9 descent20 rather than2; valid X31/a/b loops. Retain 0.3.1 hard-cut mesh accuracy without exposing the temple as a permanent pit. |
| `ch14/Y` | 2 | Restore source400-ft hill, traversable tracks/ascent and coherent west boundary; pp197-200/map199. Preserve250-ft ritual ring and50-ft effigy; summit inset is intentional, not a duplicate hill. |
| `ch15/Z` | 2 | Model5-ft ledges rather than1.6/1.28-ft stair props, approximately40-ft pool with10-ft depth, continuous rise to+100 ring; pp201-205/map202. Preserve cave enclosure and20-ft ritual ring. |
| `wsc/00-region` | region | Directed stream/basin and connected road/path/town/tower graph. Authored region, not asserted printed canon. Reconcile side path4.732 mi versus export's approximate1 mi; original source confirmation pending. |
| `wsc/01-tavern` | 2 | Preserve accepted larger inn adaptation and10-ft storey interval; authored export specs01a/01b and `wsc-town.py`. Colocate actual inn with street facade, presently5,280 ft apart. |
| `wsc/02-street` | 1 | Fix default Players movement, door openings, square/tavern continuity and overlapping structures. Authored replacement for exported street; do not reverse accepted layout merely to match earlier export. |
| `wsc/03-compound` | 4 | Preserve recorded40-ft stone tower adaptation from `d4cdd10d6c14148668aeb24dbb0d69e700e15203`, levels0/10/20/30 and deliberate aligned spiral. Reconcile regional treehouse/platform wording; original plan requires lawful access. |
| `wsc/03a-road` | 1 | Preserve70x100 canvas,0.2-ft road crown,0.5-ft undergrowth; authored export map03a. Reconcile N-S local road with E-W atlas labels and final regional joins. |
| `wsc/03b-path` | 1 | Preserve60x100 canvas,5-ft banks and shallow crossing; authored export map03b. Ground oak bases on the actual bank surfaces and test crossing/path continuity. |

The separate `dev/m0-test-room` fixture / two levels receives regression checks but never pads production coverage.

## Source conflicts and adaptation decisions to preserve

- Castle's high tower combines incompatible 300/390/450/380-ft statements/captions; roof/tower increments also conflict, and K60a's 260-ft court drop differs from the current250 datum. Record a coherent convention with explicit exceptions and source locators (structure ledger K-10/11/13, pp55/58/71-75). Do not report contradictory numbers as simultaneously satisfied. The approximate catacomb size is also not an exact resize order.
- Tsolenka's stated bridge length can include its end passages; source review supports the 70+10+10 interpretation. Do not lengthen the deck automatically.
- Krezk must retain the sourced400-ft rise. The old item6 proposal to lower it to roughly230 to ease road grades is not suitable for this scope without a separate accepted source deviation. Change route geometry instead. Likewise, do not copy the old Death House proposal to lower its source-supported13-ft attic ceiling to8 merely to fit a roof.
- V's scaffold has conflicting height/fall cues; two20-ft stages are a reasonable documented interpretation. U/U3 excavation/ceiling choices, Q's final peak datum and several upper-floor spacings are inferences. Improve physical consistency without falsely claiming exact textual support.
- N5/N7/N8 shops, the WSC region/tavern/square and the WSC stone-tower replacement are recorded authored adaptations. Preserve their identities; fix logical inconsistencies within them. A new owner interpretation is needed before reversing the tower back into a platform treehouse.
- A large `bookScaleFt=5` metadata value is not a universal conversion factor. The current schema only admits5 or10; several actual plans use40/50/100-ft grids and generators scale their source traces separately. Correct meaningful metadata/contracts without rescaling already-correct coordinates. N9's printed10-ft grid is a distinct metadata error.

## Specific paused item 7 components

No blanket item7 merge. Re-inspect each candidate against the released 0.3.1 base, extract the minimum source-backed logic change with attribution, and test it in the new context. Do not bring old global render/app/version changes along unintentionally.

| Candidate | Essential contribution to 0.3.2 | Reconciliation before reuse |
|---|---|---|
| Yester Hill height/route work | Connected outer track, reachable cairns, continuous climb and terrain join; `yester-hill.py`, necessary supporting kit/tests | The historical branch uses a272-ft summit/teleport arrangement in its open findings. Reconcile to source400-ft rise and prove actual route traversal. Grid/fog treatment is included only where needed to expose valid floors and context. |
| Amber mountain/X23 work | Grounded mountain envelope, open X23 balcony, visible/reachable interior levels and correct facade relation; `amber-temple.py`, necessary kit/tests | Preserve current hard-cut mesh fix and mountain-enclosed source intent. Avoid the old buried upper/lower floors, black Players wall, terraced silhouette and uncontrolled geometry cost. X9 and invalid catacomb corrections are separately required. |
| V floor/lift correction | Valid V5/V6 polygons, safe lift landings and supported buttresses; `van-richten-tower.py` and focused tests | Keep real shaft holes; test exact link behavior with new CORE-NAV and actual support geometry. Do not conflate outside-polygon coordinates with absent lift platforms. |
| W fence / U3 mire support | Include only confirmed support/seam fixes necessary for source/physical continuity | Verify current reproduction. Reed thinning, material stylization and generalized scenery polish are not automatically part of the dependency. |

Observed local remote-tracking candidates were `item7-amber` at `ab62630a93644f8a4bd17905bd15c22a48d47f9b`, `item7-berez-tower` at `774e1b6860f4422cdd7e0e48a63b8dd1d8aeb829`, `item7-unfinished-maps` at `fb49f1f93a51b0ab161cf280bbc8b96312d2324f`, and `item7-yester-wines` at `921741727b3e9ece9246ed7c81380c0eb592e3c0` (all under `origin/claude/wip/`). These were not refreshed by this planning lane. `AGENTS.md` names a later historical `0db19b9`, but that object is not resolvable in the observed checkout. The integration owner must verify fresh refs and obtain the actual candidate before declaring it reviewed or reused.

Item6/8/10 branches are also references, not automatic merges. Their wall segmentation, seam and hydrology findings inform this scope; old suggested resizes and reduced elevations must pass current source review. Keep a component provenance row with original SHA, selected files/hunks, rejected conflicting behavior and new test results.

## Cloud continuation prerequisites and missing inputs

The cloud can make useful progress from the public repository on topology, transitions, deterministic tests and numeric constraints in this plan. It does not need access to personal files or campaign saves. The parent provisions the runtime and authorized repository access; this document does not alter credentials, permissions, power settings or security controls.

| Prerequisite | Available or missing; next action |
|---|---|
| Exact source checkpoint and ownership | Parent confirms pushed candidate `81b02a3cfa6f02af22072f743446c0ca9ed4f8e0`, root branch `item2-map-logic-032`, and cloud transition base `55b118e0b78a89b04d0780dd0c713f0a54632c9c`. This plan still needs the root's separate commit/push and integration into the new branch. Root supplies its exact SHA and current task matrix. Fresh-fetch relevant branches and preserve history. |
| Current 0.3.1 release boundary | Root supplies final release ancestor and test/build fingerprints when complete. Historical green checks in the audit do not replace fresh exact-head results. |
| Reproducible runtime | Parent confirms cloud baseline build, units and desktop checks pass and SwiftShader is available. Record actual runtime versions: Node>=22 with committed lockfile, Python>=3.11 with numpy/scipy/shapely/Pillow, Playwright browser dependencies. Poppler/Tesseract are needed only for authorized source/OCR work. No workstation junctions or machine-specific paths may be assumed. |
| Licensed CoS PDF/map images/OCR | Not in Git and must not be uploaded to a public handoff. Numeric facts, room keys, page locators and original-word constraints are conveyable here; direct source-image review requires a separately authorized private source supplied in the cloud environment. If absent, retain per-map source-review limits and do CPU implementation work that does not depend on new visual interpretation. |
| Ignored generator inputs | `reference/imports/village-extract.json`, `reference/imports/wsc/mapset.json`, the seed JSON consumed by `import-ml.py`, and relevant `reference/pages.json` metadata are absent from a clean clone unless separately provisioned. Some import paths are historical machine defaults. Inventory exact required files and hashes privately; never commit the inputs. Pass explicit relative paths. If inputs cannot be lawfully provided, root must assign a reviewed deterministic replacement recipe rather than hand-edit generated scenes or fake regeneration. |
| Sheep Chase original source | Prior authored export establishes adaptation history, but publisher PDF verification remains incomplete after a download challenge. Do not bypass the challenge or label export evidence a publisher-map inspection. An authorized source copy or recorded owner interpretation is still needed for contested canonical claims. |
| Private runtime evidence | Local screenshots, PDF renders, campaign saves and browser profiles are not handoff payloads. Reproduce tests from tracked fixtures; create clean synthetic saves. Existing JSON summaries convey counts/locations but not a fresh visual pass. Use relative repository evidence references, not old machine paths. |
| GPU and real device verification | A cloud software renderer can run tests and detect failures, but cannot certify the laptop GPU or physical-phone behavior. Provision a suitable test runner or leave the exact gate pending for the integration owner. Do not disable GPU assertions to make the fallback green. |
| Overnight coordination | Cloud task `01a13894-97b1-7226-881c-4da050fb00d0` is prepared with the explicit independent transition assignment. Parent records its branch/ref and any actual outage trigger or expanded takeover grant separately. This Markdown file does not itself schedule a run, detect an outage or authorize overlapping edits. |

When the laptop becomes unavailable, the fallback continues only its last explicitly assigned disjoint areas or the takeover scope recorded by the parent. It reads fresh remote status before writing; timeout or loss of contact alone is not proof that an overlapping checkout stopped. Use an explicit ownership handoff for shared files/integration. Push tested incremental progress to the agreed WIP or draft PR, preserving one concern per commit and the required ChatGPT attribution. Record unfinished tests and exact next commands before stopping. When the laptop returns, root reconciles cloud commits with merge commits and resumes exclusive integration ownership before touching overlapping files.

Do not send external messages, publish builds, change repository visibility, upload source books/art or transfer private saves as an implied part of fallback preparation. The independent cloud task and any private source provision are the parent's operations. Any unresolved source-access, authority or GPU gate must name the exact missing prerequisite while leaving independent authorized work moving.

## Handoff checkpoint format

Each task reports: source baseline and current SHA; owned files and generated outputs; numeric/source constraints resolved; unresolved ambiguity; failing-first and passing checks; review/fix-pass status; build fingerprint and runner; implementation/source/runtime/visual counts; save/migration impact; component provenance; next command and current owner. Use a short issue list with exact file/field locators. Update the root's shared status before leaving work so another agent can continue without guessing.

This planning lane changed only this document. It did not modify application code or data, build, run GPU checks, commit, merge or publish.
