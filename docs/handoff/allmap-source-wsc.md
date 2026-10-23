# Sheep Chase authored-reference audit

Baseline `785421cb45ad3b7a5467a14f6e696074efb9bd27`. Six maps / nine levels compared with the local authored export; original publisher-map review remains blocked. This is reference verification, not full canonical sign-off.

## wsc/00-region

- **authored choice:** The export explicitly identifies the region as an authored setting, so its exact terrain and pins cannot be certified as printed module geography. Evidence: Export specs/00-region.json and DECISIONS.md; current world.json.
- **source-reference discrepancy:** The retained side-path polyline is 4.7320 miles long. The authored export describes roughly one mile of side-path travel; its geometry and prose disagree. Original module confirmation remains pending. Evidence: world.json roads[Side path].pts; export specs/00-region.json.
- **measured risk:** The raw regional stream profile ranges from 0 to 375 ft and includes rises and falls in either travel direction. Coherent downstream flow is not established. Evidence: allmap-audit-inventory.json regional river profile, 80-ft maximum sampling interval.

## wsc/01-tavern

- **recorded adaptation:** The local export offers an invented 30 by 40 ft tavern with one upper floor. Current wsc-town.py deliberately authors a larger inn with an alley and outbuilding. Its plan should be reviewed against the accepted adaptation, not reported as a measured book-map mismatch. Evidence: Export specs/01a-tavern-L0.json and specs/01b-tavern-L1.json; scripts/authoring/wsc-town.py; current scene.
- **confirmed authored continuity discrepancy:** The region places the tavern and the street outside it at independent root pins exactly 1 mile (5,280 ft) apart. The street retains its own tavern facade, so the local exterior and true interior are not colocated. Evidence: world.json pins 1=[2.5,4.041] and 2=[3.5,4.041]; atlas depth=0 for both; export specs/02-town-street.json identifies this as the adjacent street.
- **supported authored relationship:** The two current levels retain a 10-ft vertical separation and one connecting stair link. Exact room footprint and door traversal require runtime reconciliation. Evidence: scene levels L0=0/L1=10 and lk-stairs; export level elevations.

## wsc/02-street

- **recorded adaptation:** The current six-area town square is an authored replacement for the earlier generic street. Its neighboring shells are not claimed as canonical module buildings. Evidence: scripts/authoring/wsc-town.py; export specs/02-town-street.json source=possible.
- **confirmed runtime failure:** All six attempted short moves from the actual default party entry failed in Players mode. The probe does not establish which floor, wall or door causes the failure. Evidence: runtimeFirstPass in allmap-audit-inventory.json; index-B3tGevXq.js.
- **shared finding:** The street facade and true tavern are separated by a mile at independent regional pins; see wsc-tavern-street. Evidence: world.json pins 1/2 and world-atlas.json.

## wsc/03-compound

- **recorded source divergence requiring owner interpretation:** The exported treehouse has offset platforms about 34/60/20.5 ft across. Commit d4cdd10d6c14148668aeb24dbb0d69e700e15203 deliberately replaces it with four colocated 40-ft octagonal floors, a spiral stair and conical roof. The current regional blurb still calls it a treehouse with platforms. Do not silently reverse this older adaptation. Evidence: Export specs/03d,03e,03f; scripts/authoring/noke-tower.py CX/CY/R/TOWER/STAIR; docs/CHANGELOG.md M3.0; world.json pin5.
- **supported authored relationship:** Current floors remain at 0, 10, 20 and 30 ft, matching the export elevations. The three links share [67.5,52.5] by deliberate spiral-stair design; this is not an accidental loss of the earlier offset stair endpoints. Evidence: scene levels and links; noke-tower.py STAIR/sp; export specs/03g.

## wsc/03a-road

- **supported authored relationship:** The current ground canvas remains 70 by 100 ft, with the 0.2-ft road crown and 0.5-ft undergrowth patch heights retained from the authored export. Evidence: scene room L0-2 and patch1/patch2; export maps/03a-main-road-pasture.json.
- **integration review required:** The exported main road crosses the local canvas north-south, while atlas road-exit labels assign east-west regional bearings. An exact road-label/orientation check against the final rendered join is still needed. Evidence: export maps/03a-main-road-pasture.json road decal x20..35,z0..100; atlas roadExits; no assumption that a nearest road proves access.

## wsc/03b-path

- **supported authored relationship:** The current floor is 60 by 100 ft. The export deliberately gives two northern banks 5-ft relief and a shallow crossing through the middle. Evidence: scene room L0-1 and patch1/patch2; export maps/03b-woodland-path.json.
- **confirmed authored geometry discrepancy:** Oaks 1,3,5,15 and20 have bases at y=0 inside 5-ft raised northern bank polygons. Their trunks start 5 ft below the bank tops. This matches the existing parked item6 finding; that branch has not been merged. Evidence: scene object positions and patch polygons; docs/handoff/item6-map-groups.json sheep-chase group.

## Limits

The official publisher PDF could not be retrieved: the direct download returned a browser challenge and the browser tool failed at startup. No access control was bypassed. The prior export itself contains declared map-versus-narrative choices, including platform diameter differences; preserve those as interpretation decisions. No source art or book prose is committed or uploaded.
