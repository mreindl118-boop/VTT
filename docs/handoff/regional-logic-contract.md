# Regional water and road contract for item 2e

Prepared 2026-10-14 for the 0.3.2 regional implementation owner. This is source diagnosis and a proposed physical constraint model, not implemented geometry, a rendered pass or release approval. Root owns regional implementation and integration; the independent cloud task owns transition/arrival behavior. This lane changes only this document.

## Evidence and confidence

The source-ledger baseline is `785421cb45ad3b7a5467a14f6e696074efb9bd27`. This lane inspected the regional data at `ef64809f7ff1ef4489fb4498bc19401a7001cb05`; cloud integration changes were concurrently staged by root. Existing `allmap-source-images.md` was read first. The authorized local PDF's complete printed p35 regional map and enlarged western/central reaches were then inspected, alongside the relevant narrative on pp35-40, 157, 159, 161, 167 and 181. No new source image or copied narrative is saved in Git.

Evidence classes used below:

- **Fact:** an explicit narrative relationship/dimension, or visible map connectivity/position. A map line's connectivity does not establish its flow direction.
- **Inference:** a physical interpretation consistent with those facts; identify it in data/tests as a design choice.
- **Open:** a source conflict, missing detail or unverified interpretation. Do not turn an open item into a passing canonical assertion.

Use `allmap-source-ch02.json`, `allmap-source-structures.json` and `allmap-source-remaining.json` for the already recorded local measurements. Their original image-review limits remain historical; the later image audit and this focused map inspection supplement them. Printed page numbers are used throughout; OCR/PDF file page numbers are printed page plus one.

## Direction decision: do not derive flow from line order

**Recommended inferred Luna direction is Zarovich -> P -> Berez -> T -> Luna Lake**, then onward along the visible western continuation. It is not stated by arrows or an explicit downstream sentence. The opposing Luna Lake -> T -> Berez -> P -> Zarovich option is possible only with additional terrain/drainage assumptions that the reviewed source does not supply. Do not label either direction a quoted canonical fact.

The decisive context is not today's absolute terrain sampler. P's southeast riverside route descends toward Berez (p40); Berez is a flooded, marshy river settlement reached from the north (p161). The p35 map connects Zarovich's southwest edge to that corridor, shows mountain-fed channels entering Zarovich from the north, and shows further water continuations beyond Luna Lake. Those observations favor southbound Luna flow. T is a high **road above a river**: the water is explicitly 500 ft below its bridge (p159). That does not establish that its river is higher than Zarovich. The current T deck of 3,684.15 ft and derived river near 3,184.15 ft are implementation choices, not source elevations.

This recommendation must be recorded as the integration owner's chosen inferred drainage model. If preserving those current T/Zarovich heights makes the recommendation impossible, change the unsupported absolute datum model or document an accepted deviation; do not silently reverse source context or make the river climb.

## Water networks

| System | Source-supported spatial graph | Direction and limits |
|---|---|---|
| Ivlis / Tser | The p35 map shows an unnamed mountain pool southwest of H, a winding channel running north then east to H, a reach from H southeast into Tser Pool beside G, then the Ivlis through the village/D reach and onward east. The high and low H routes describe the same falls/pool system (p37). | H's receiving pool feeds the valley river: H -> G -> D/east is supported by p37 plus p35. The upper unnamed pool -> H crest is the coherent inferred upstream direction. No Luna-to-Ivlis confluence is visible; keep these catchments separate. |
| Luna | Zarovich's southwest connection -> river corridor near P -> U/Berez -> T crossing -> east side of Luna Lake is visible on p35. A small branch/pool appears east of the P-U reach. Luna Lake has west and south water continuations. | Main southbound direction is the recommended inference above. The east branch is a tributary candidate, not automatically a second mainstem. The west continuation remains part of the named Luna context. The southern lake continuation's inlet/outlet role is unresolved; retain its physical connection and choose its gradient explicitly before directing it. |
| Raven / Baratok | Lake Baratok connects southward toward R; the river runs west below the Krezk approach and toward the map edge. R's northern road bridge is explicit (p40). V sits on a lake island reached by causeway (p167). | Baratok -> R -> west is a reasonable inferred drainage direction, supported by the basin and open western continuation, not explicit arrows. No connection to Zarovich or Luna is shown. Do not invent an inter-basin channel to make existing fragment endpoints meet. |
| Zarovich feeder catchments | Several channels descend from the northern mountainous surroundings to the north side of Zarovich (p35); L's lake is at the mountain foot and has a still surface (pp38-39). | Northern uplands -> lake is inferred drainage. Add enough connected catchment context to explain the water; exact discharge, spring locations, channel depth and source altitude are not specified. |

The repeated D markers are identifiers along one river, not proof of two additional downstream bridges. P35's narrative names two stone-bridge locations overall: the village reach and H. `barovia-cover.py` labels its added D2 pin "east bridge", but that generator label alone is not source evidence for another road crossing. Preserve the river reach and verify the crossing symbol/route before creating an extra bridge.

Do not automatically direct both Luna Lake boundary continuations outward. A main eastern inflow and western outlet, with the southern branch as a mountain tributary, is a coherent option; a second outlet requires a stated hydraulic interpretation. The map supplies connection lines, not their head differences. There are no surveyed contour elevations or absolute lake levels in these reviewed sources.

## Numeric and relative anchors

Use separate values for water surface, bed, bank, road deck and supporting terrain. A negative local scene level is not automatically a riverbed; a bridge drop is not water depth. All heights below are feet.

| Anchor or relation | Contract | Source / classification |
|---|---|---|
| H bridge to receiving pool | Approximately 1,000 vertical separation. Keep a high bridge, deep open natural gorge and pool below. Current 960 is an approximation to reconcile, not an immutable constraint. | P37 H; approximate source fact. |
| H crest and upstream channel | Continuous water-bearing upper channel into the fall, fall into pool, pool outlet toward G. Crest geometry must agree with the mountainous side of the bridge. Do not equate the exact crest datum to the deck without recording that inference. | P35 map and p37; topology fact, unsurveyed heights inferred. |
| G water body | River widening a few hundred feet across, beside the camp; local plan puts water north of camp. Pool, inlet and outlet have one connected surface. | P36, source fact; current 360-ft circular diameter is an authored approximation. |
| Ivlis D | Roughly 50-ft channel width; water depth 5-10 ft. Stone arch at the village crossing. | P35 D; approximate width, explicit depth range. No canonical 15-ft deck/water clearance was found. |
| T crossing | Deck minus river surface = 500; tower roof = deck + 40 and roof minus valley = 540. Interpret river/valley datum consistently locally. | P159 T6/T8; explicit relative dimensions. |
| T bridge plan | 10-ft width, 90-ft total crossing; existing source audit supports 70-ft central deck plus two 10-ft end passages. North is left on the local p158 plan. | P158 plan / p159 narrative. Preserve interpretation rather than stretching the middle span blindly. |
| U water | Variable depth, at most 10 ft. Flooded marsh and standing water around ruined settlement, with shallower local pools. | P161; explicit maximum and source landform. |
| V causeway | About 300 ft from shore to island; island remains surrounded by the same Baratok lake surface. | P167; source distance. Current clipped 305-ft result is not an exact source number. |
| P road to U | Gentle descent into the river valley; ordinary Old Svalich through-route at P is generally level. | P40; qualitative relative grades. |
| R road branches | Eastward toward Vallaki rises gradually; southwest winery route descends gently; southward T route climbs mountains. | P40 / p157; qualitative grades. |
| Krezk / S10 | Preserve the abbey's 400-ft rise over the village; solve the road, not a reduction to 230 ft. | Existing S source ledger, pp143-148. |
| J/K | Preserve the 1,000-ft cliff consequence and 50-ft entrance gap; direct drawbridge-to-courtyard registration remains required. | P38 / castle source ledger. Do not flatten the pillar to ease an unrelated river or road join. |

### Proposed constraint representation

Each hydrologic node should have a stable ID, position, surface datum, optional bed/depth, source locator, confidence and connected edge IDs. Each edge should have explicit upstream/downstream IDs, centerline, width/depth rule, and its inference status. Reversing the stored point array must not reverse the semantic flow. Lakes are shared level surfaces with registered inlet/outlet points, not independent ellipses floating over the heightfield.

Use free datum variables rather than canonizing today's sampler output:

- Ivlis: `H_crest > H_pool >= G_pool >= D_water >= eastern_exit`, with positive downstream fall between separated flowing reaches. `H_deck - H_pool ~= 1000`. The pond/pool surface itself stays level; do not apply a slope across a standing lake to hide a join. Its bed lies below its water surface.
- Recommended Luna: `Zarovich >= P_water >= U_water >= T_water >= LunaLake >= western_exit`, with a positive drop along flowing reaches and equality only where physically appropriate. `T_deck = T_water + 500`. P's bank/road stays above nearby water; U's low bank and marsh can approach it. `P_road > U_approach`, `T_deck > R_road`, and the P/Vallaki through-route is broadly level.
- Raven: `Baratok >= R_water >= western_exit`; `R_bridge > R_water`, but its clearance is an authored value unless another source establishes it. Place R's roads and lake shore so the sourced directional grades survive. There is no sourced numerical equality between the two northern lakes.
- Keep `S10_court = S_village + 400` and `K_cliff_top = local_cliff_bottom + 1000` as independent site constraints. Their surrounding slopes and approach lengths absorb regional datum changes.

These inequalities are feasible together; they do not force T's river above Zarovich. A large mountain summit and snowy pass may remain above a much lower incised river corridor. No absolute seed height is selected here: the integration owner should choose a common datum and solve all anchors together, then publish the numeric choices as inferred. Do not set Ghakis's current 7,400-ft generator peak or X's current 6,987.935-ft facade as canonical constraints. The temple is carved into a snowy mountain slope (p181), but the reviewed source supplies no absolute elevation or exact vertical difference from T.

## Route contract and road classes

| Route | Required connection and type | Grade / distance constraints |
|---|---|---|
| Village/D -> F -> H high road -> I | Continuous road; the F-H climb is distinct from F-G camp access. I also branches toward the western gates and J/K. | F's southwest branch climbs to H; south of H the road descends toward F, north continues through mountains to I (pp35,37). Keep bridge approaches at the deck, never at the receiving pool. |
| F -> G -> H low route | F-to-G descent can accommodate the source's visiting wagons. Beyond G, the northbound route follows the river to the base of H as a footpath. | Pp35-37. Do not replace the high road with a direct carriage route through the gorge. H's sheer slippery sides need climbing aid; low/high levels are not an ordinary walkable stair. |
| I -> J -> K | Road used by the eight-person horse-drawn carriage; actual entrance continues over the drawbridge into the courtyard. | P38; all joins need a traversable width and credible sustained grades. No source numerical road-grade limit was found. |
| N -> P -> R/Krezk | Old Svalich through-road. P's NE branch meets a stone bridge over Luna about a quarter mile away. | P40; use roughly 1,320 ft along the route, not straight-line distance. Avoid turning a generally level junction into steep opposing ramps. |
| P -> U | Riverside trail, approaching Berez from the north and ending in marsh. | Gentle descent (p40); several-mile approach (p161). It is not a paved all-weather carriage road merely because it shares a regional line with the highway. |
| P -> V -> Old Svalich / R | NW branch climbs gently, becomes a woodland trail within half a mile, rejoins the main road after a couple of miles, and has a V spur. R separately has a northbound V path. | P40. Preserve the loop and spur rather than collapsing V onto a straight line between P and R. Tower causeway is about 300 ft (p167). |
| R -> T | Gravel mountain road, climbing via the lower mountains and Ghakis flank to gatehouse/tower/bridge. | P157 gives seven miles from R to the T structures. Calculate connected route length, retain plausible switchbacks and exposed rock shelf. Do not use a current incomplete fragment's length as the entire journey. |
| T -> eastern fork -> X / southern boundary | Pass continues for three miles beyond T before branching north toward X and south around Ghakis to the mist boundary. | P159. Three miles ends at the fork, not automatically at X. Preserve a separate northern temple approach and southern continuation. P181 supports a snowbound mountain-enclosed temple, not a valley building or permanent excavation pit. |
| R -> W; R -> Krezk | Winery route turns west/southwest and becomes gravel trail; Krezk road uses the northern river crossing. | P40; gentle winery descent, gradual eastward rise at R. Test paths through the exact crossroads/bridge, not proximity alone. |

Road classification is a terrain/access contract, not a new game rule. Distinguish carriage-capable approaches, gravel mountain road, woodland trail, marsh trail and assisted climb. Source text supplies no universal maximum slope. The implementation owner must choose and record class-specific grade/curvature assumptions, preserve required vertical differences, and test the entire longitudinal route. A 25% historical diagnostic threshold is not owner-approved canonical tolerance. A snowy road can be hazardous without being a cliff or discontinuous mesh.

## Existing data cannot be used as a ready-made directed graph

At the inspected regional snapshot, `rivers[0]` is a coarse lower Ivlis line beginning near G, `rivers[1]` is the coarse Luna line with the later T tie, and `rivers[2]` is coarse Raven. Remaining named fragments include overlapping traces and loops; `rivers[11]` is the added Tser Pool outlet. Those indices identify this snapshot only. Reconstruct semantic edges rather than keeping their array order as flow.

`barovia-cover.py` retains hand-measured whole courses, then appends independently skeletonized water fragments (`rivers` construction near lines247-250). It assigns names by proximity. It also masks water to the vicinity of known named courses/lakes. This can omit an unnamed headwater or lake continuation and can leave near-duplicate/looping geometry. Road skeleton fragments likewise do not promise full connectivity, road class, direction or accurate route length. The original `barovia-world.py` base is not a replacement for the refined region: rerunning it alone discards traced cover and added details.

Confirmed diagnosis boundaries:

- H's upper mountain-pool/channel and full H-to-G connection are missing from the coarse base river definition. Root's independent CPU reviewers reported a 6,107-ft regional gap. This lane verifies the missing source-required connection, not that exact runtime distance anew.
- The existing G outlet joins a traced Ivlis fragment but does not itself prove a connected directed path through every lower segment to D. Join the actual G shoreline inlet/outlet and H canyon, not only pool centers.
- Current downstream surface datums H336 -> G366.55 -> D487 rise rather than fall. They cannot all be retained in an ordinary H-G-D drainage solution. D's current deck502 also does not establish a sourced 15-ft clearance.
- Luna's current main line ends at the lake center; visible west/south connections and northern feeder context need explicit treatment. A lake-center endpoint is not a shoreline/outlet contract.
- Current Raven's coarse course heads southwest through the winery vicinity, while the p35 source's named Raven continuation runs west below Krezk. The regional trace requires positional reconciliation, not just a monotone height applied to the existing coarse path.
- Root reports an outlet berm of 2.1 ft and noise-draped water ribbons. Preserve these as root's measured regressions; this source lane did not rerun the renderer or CPU height probes. The fix must connect the physical bed as well as the water surface.

## Required implementation acceptance

1. Build a connected graph for each catchment and every road journey above. Verify actual common endpoints and boundary crossings in the global coordinate system. Check each expected source connection exactly once; duplicates or crossing lines are not automatically junctions.
2. Sample along complete directed rivers, at bends, tributary/lake joins, both sides of site seams, and across the actual rendered triangles. Surface does not rise downstream; bed permits the intended flow, depth and outlet. Test reversals of storage order and ensure semantic direction survives. No end cap, noise ridge or local flattening berm blocks a registered channel.
3. Enforce the 500-ft T separation, approximately 1,000-ft H relation, D depth/width and U maximum depth separately. The source's approximate statements need an explicit documented interpretation rather than a hidden generic epsilon. Keep numerical mesh precision tolerances separate from source interpretation.
4. Test the R-T seven-mile journey, T-to-fork three-mile segment, P-to-bridge quarter-mile route and P/U descent against connected paths. Every bridge has two supported approaches at deck height and a distinct underpassing channel. Preserve S/S10 and J/K vertical constraints.
5. Wide-context visual review is mandatory: H's upstream catchment, crest, drop, broad natural gorge, receiving pool, entire downstream valley reach, high road and low path must read as one landscape. Inspect both banks and approach directions from wide and local views. A close-up fall inside a short cut with buried continuations fails. Apply the same inspection to P-U-T-Luna and Baratok-R-west.
6. Verify source scale and placement, runtime travel/entry, and rendered terrain/shore/material seams independently. Keep mountain mass around X while exposing intended active interiors. Regenerate source-derived data deterministically and preserve save identity/coordinates or supply a migration when meaning changes.

## Inputs and remaining limits

`heightfield.py`, `barovia-world.py`, `site-continuity.py`, their local scene inputs, and current regional `world.json` are tracked. A new semantic hydrology contract built from those tracked data and sanitized facts does not intrinsically require a private import. However, regenerating the image-based regional survey with `barovia-cover.py` requires the ignored authorized `reference/module/curse-of-strahd.pdf`, Poppler's `pdftoppm`, and numpy/scipy/Pillow. Its cached page is an intermediate, not an independently publishable input. Do not run it against an absent/stale cache or silently substitute the coarse base map.

The village/WSC/import seed extracts are not dependencies for this bounded regional profile work unless another generator is brought into the run. The complete authoring pipeline must declare its input/output set before execution; `site-continuity.py` expects specific refined road coordinates and generated G/T/X geometry. Updating the regional graph will require making those ties semantic/idempotent rather than leaving fragile exact-point lookups.

Remaining source limits are narrow and explicit: Luna/Raven directions and the southern Luna Lake branch role are inferred; absolute terrain heights, river discharge, exact upper catchment shapes, road grade limits and X altitude are unsurveyed. The H-G-D direction and specified local dimensions above are much firmer. No newly imposed datum, chosen slope envelope or interpolated landscape should be presented as copied from the source. No application edit, build, GPU run, commit or release occurred in this lane.
