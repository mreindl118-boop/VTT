# Map-logic audit, 2026-10-18 (version 0.3.1)

- **What:** every level of all 45 scenes on main `90cfa32` (0.3.1): where the party starts, its first steps, doors, room reachability, vertical links, ground, lattice and files, and nested placement. Findings only; nothing was changed.
- **How:** CPU checks ported from the engine (`canWalk`, `moveBlockers`, `ensureDefaultToken`, the link loop, `worldland` height), one runtime pass in a headless browser against the served build of main, and a hand-checked sample from every family. Main moved to `55def97` (0.3.2) while the audit ran; the families say what a spot check on 0.3.2 changed (ch10/U, ch10/U3, ch11/V, ch12/W, ch13/X, ch14/Y).
- **Limits:** software rendering on a shared machine. The book was not consulted, so source accuracy is out of scope (ChatGPT's reports cover it). Static rules can misfire where a finding says "likely" or "doubtful"; those need a runtime walk before anyone fixes them. ch05/N town and ch10/U berez lattices were too large for the ported `canWalk`; the browser walked them instead.

Counts: 40 families. 2 blockers, 21 major, 13 minor, 2 nits, 2 reported elsewhere but not reproduced on main. 13 maps play clean, 20 play with faults, 10 are broken for at least one thing a table would do, plus the dev fixture and the two WSC roads.

## The scorecard

Steps: how many of the party's eight first 5-ft steps are allowed (static; runtime in the browser). Ground: the height of the entry floor over the drawn land at the start.

| Map | Levels | Start | Steps | Doors | Rooms | Links | Ground | Lattice | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| appB/death-house | 6 | ok | 1/8; runtime 1/8 | 1 floor one side only | ok (57) | 4 of 16 activations wrong level (2 fire twice+), 6 markers dropped | flush (+0.6 ft) | ok | plays with faults (stairs chain, lost markers) |
| ch02/A | 1 | ok | 8/8 | no doors | ok (6) | no links | flush | ok | plays |
| ch02/B | 3 | ok | 8/8 | no doors | ok (8) | ok (4) | flush | ok | plays |
| ch02/C | 1 | ok | 8/8 | no doors | ok (1) | no links | flush | ok | plays |
| ch02/D | 3 | ok | 8/8 | no doors | ok (5) | ok (6); D-beach, D-wash snapped off floor (can step back) | ground floats 7 ft | 14 bad polygons; drawn ground outside floor (river) | plays with faults |
| ch02/F | 4 | ok | 8/8 | no doors | ok (5) | ok (3); F-knoll-stair off floor, F-gallows-stair snapped off (can step back) | day floats 25 ft | ok | plays with faults (entry floats 25 ft) |
| ch02/G | 1 | ok | 8/8 | no doors | ok (1) | no links | flush | ok | plays |
| ch02/H | 3 | ok | 8/8 | no doors | ok (5) | ok (3); 3 across stacks 580-960 ft | pool buried 960 ft, ledge 580 ft | 4 bad polygons | plays with faults (pool level under the land) |
| ch02/I | 2 | ok | 8/8 | no doors | ok (5); 1,888 ft2 orphan | ok (2); I-scramble-post off floor (can step back) | flush | 3 bad polygons | plays with faults |
| ch02/J | 3 | ok | 8/8 | no doors | ok (12); 225 ft2 orphan | ok (3) | flush | 3 bad polygons; drawn ground outside floor | plays (minor) |
| ch02/L | 2 | ok | 8/8 | no doors | ok (5) | ok (2) | flush; lakebed under the land as expected | ok | plays |
| ch02/M | 4 | ok | 8/8 | no doors | ok (8) | ok (4); M-cleft 216 ft horizontal | shelf floats 40 ft | drawn ground outside floor: shelf 69%, fog | plays with faults (entry floats 40 ft) |
| ch02/P | 3 | ok | 8/8 | no doors | ok (13) | ok (3); P-pier snapped off (can step back) | ground floats 24-31 ft where the ch05/N band overlaps; river buried 10 ft | 1 bad polygon | plays with faults |
| ch02/R | 4 | ok | 8/8 | no doors | 2 of 6 unreachable (notch level) | 5 of 12 arrivals off floor (ledge-steps, shelf-climb stuck) | bench floats 6 ft | 7 bad polygons; drawn ground outside floor (river) | plays with faults (notch level unreachable) |
| ch03/E | 1 | ok | 8/8 | no doors | ok (7) | no links | flush | ok | plays |
| ch03/E5 | 2 | ok | 8/8 | 5 overlapped by a wall, 5 unpassable when open | 4 of 7 unreachable; party starts in sealed E5f | lk-ground-undercroft arrives 8 ft off floor (stuck) | flush | 4 walls through nodes | broken (nave sealed, undercroft unreachable) |
| ch04/K | 12 | party on dungeon, view on ground | 8/8 | 14 overlapped by a wall, 4 unpassable when open, 30 floor one side only | 59 of 161 unreachable | 32 of 94 activations wrong level (11 fire twice+), 27 markers dropped, lk-k51 off floor, 5 same-level links | flush (dungeon -80 ft as expected) | 8 walls through nodes; drawn ground outside floor (ground 44%) | broken |
| ch05/N | 1 | ok | runtime 8/8 | ok (3) | ok (14) | no links | flush | ok | plays |
| ch05/N1 | 1 | ok | 8/8 | 0 door records | 5 of 6 unreachable; party sealed in N1f | no links | flush | 4 walls through nodes | broken |
| ch05/N2 | 3 | ok | 8/8 | 9 overlapped, 7 unpassable when open, 2 floor one side only | 9 of 20 unreachable | ok (6) | flush | ok | plays with faults (9 rooms sealed) |
| ch05/N3 | 3 | ok | 8/8 | 6 overlapped, 6 unpassable when open, 1 floor one side only | 16 of 23 unreachable | ok (3) | flush | ok | broken |
| ch05/N4 | 3 | party on cellar, view on ground | 8/8 | 4 overlapped, 4 unpassable when open; 2 rooms sealed by windows | 11 of 28 unreachable | ok (3) | flush (cellar -11 ft as expected) | ok | broken |
| ch05/N5 | 1 | ok | 8/8 | ok (9); N5c locked only | 1 of 4 (N5d wagon, no door) | no links | flush | ok | plays (wagon likely intended) |
| ch05/N6 | 2 | ok | 8/8 | 2 overlapped, 2 unpassable when open, front door to no floor | 5 of 8 unreachable | ok (1) | flush | ok | broken |
| ch05/N7 | 1 | ok | 8/8 | ok (3) | ok (3) | no links | flush | ok | plays |
| ch05/N8 | 1 | ok | 8/8 | ok (3) | ok (5) | no links | flush; child covers parent room N8c | ok | plays |
| ch05/N9 | 1 | ok | 8/8 | ok (7) | 8 of 18 wagons closed (likely intended) | no links | flush; 58-ft burial not reproduced | 4 walls through nodes | plays |
| ch06/O | 4 | ok | 8/8 | ok (1) | ok (4) | 3 of 6 activations wrong level, 2 markers dropped | flush | 10 walls through nodes | plays with faults (stairs chain) |
| ch07/Q | 6 | ok | 8/8 | ok (46); 5 closed doors bypassable (138-ft open boundary) | ok (77); 3 locked only | 7 of 30 activations wrong level (4 fire twice+), 4 markers dropped | flush | 20 walls through nodes | plays with faults |
| ch08/S | 3 | ok | 8/8 | ok (5) | 3 of 24 unreachable (ledge S7-S9) | ok (11); lk-ladder-a boxed in, lk-ladder-j snapped off, lk-switchback 202 ft | flush | 4 walls through nodes (181 on the village wall) | plays with faults (ledge cut off) |
| ch08/S10 | 5 | spawn [135,-7.5] 67.9 ft off the floor | 0/8; runtime 0/8 | 1 floor one side only; 9 cells locked only | ok (42) from the links | lk-road arrives at the same off-map point (stuck), 239 ft | abbey 400 ft over a footprint that is 4% of the map | 14 walls through nodes; drawn ground outside floor | broken (players cannot move) |
| ch09/T | 4 | ok | 8/8 | ok (1) | ok (13); gate-top (T2) has no entry | T-stair arrives in the stair opening (stuck) | flush | ok | plays with faults |
| ch10/U | 2 | ok | runtime 8/8 | no doors | ok (11) | ok (1) | flush | 5 walls through nodes; cellar grid origin off lattice | plays (origin nit) |
| ch10/U3 | 2 | ok | 8/8 | no doors | ok (2) | ok (1) | flush | ok | plays |
| ch11/V | 4 | ok | 8/8 | ok (1) | ok (9) | 3 of 10 activations wrong level, 2 markers dropped; lift arrivals in the shaft void (fixed in 0.3.2); V-scaffold-2 snapped off | flush | 4 bad polygons (fixed in 0.3.2); 12 walls through nodes | plays with faults (stairs chain remains in 0.3.2) |
| ch12/W | 4 | ok | 8/8 | ok (28) | ok (30) | 4 of 20 activations wrong level (2 fire twice+), 4 markers dropped; W13, W16-hole off floor; W9-west/east boxed in | flush | 4 bad polygons | plays with faults |
| ch13/X | 3 | ok | 8/8 | 1 floor one side only; 3 locked only | ok (62) | 1 marker dropped; X-fissure snapped off floor (stuck) | not buried on main (upper +32, lower +2 ft over the cut land) | 6 bad polygons; 11 walls through nodes | plays with faults (X-fissure stuck) |
| ch14/Y | 2 | 2 spawns; party on hill | 8/8 | no doors | ok (12); summit has no entry | no links (0.3.2: 4 stairs jumps of 153-542 ft) | flat: both levels 0 ft | 2 bad polygons | broken at 0.3.1 (flat, summit unreachable); 0.3.2 climbs by teleport |
| ch15/Z | 2 | ok | 8/8 | ok (1) | ok (14); 588 ft2 orphan | ok (1); Z-tunnel 167 ft across stacks | flush; ring 94 ft beyond the footprint | 3 walls through nodes | plays |
| dev/m0-test-room | 2 | ok | 8/8 | ok (2) | ok (4) | ok (1) | not staged | ok | plays (fixture) |
| wsc/01-tavern | 2 | ok | 8/8 | 2 floor one side only | 1 of 14 unreachable (T6 stable) | ok (1) | flush; one hex from the square | drawn ground outside floor: L0 46% | plays with faults (yard not floor) |
| wsc/02-street | 1 | spawn [50,67.5] on the ring road, not floor | 0/8; runtime 0/8 | 2 floor one side only | 6 of 6 unreachable | no links | flush | drawn ground outside floor: L0 78% | broken (players cannot move) |
| wsc/03-compound | 4 | ok | 8/8 | 3 floor one side only | 3 of 7 unreachable (L0 outbuildings) | 3 of 6 activations wrong level, 2 markers dropped | flush | 8 walls through nodes; drawn ground outside floor: L0 79% | plays with faults |
| wsc/03a-road | 1 | ok (2.25 ft from a wall) | 5/8; runtime 5/8 | ok (3) | ok (2) | no links | flush | ok | plays |
| wsc/03b-path | 1 | ok | 8/8 | no doors | ok (1) | no links | flush | 1 floor polygon over undrawn ground (under 2%) | plays |

## Findings by family, worst first

Status words: **confirmed** means a static check and the runtime or a hand check agree; **likely** means one static method only, with the geometry read by hand; **doubtful** means the rule may be misfiring and a runtime walk is needed first.

### Blockers

**1. A1 - Party start off every floor polygon: players cannot move.**
Count: 2 scenes (ch08/S10, wsc/02-street). Status: confirmed (static and runtime 0/8 agree; hand: S10 spawn (135,-7.5) against a ground floor that starts at z = 60; 02-street spawn (50,67.5) with only the six room polygons in the grid). What a table sees: the Players' side cannot move at all; `ensureDefaultToken` never checks the floor and `canWalk` refuses every step from a point off every floor polygon. Examples: ch08/S10 ground spawn, 67.9 ft off the floor (lk-road arrives at the same point); wsc/02-street L0 spawn on the ring road. Smallest fix: a generator rule in `authorlib` that asserts the spawn and every link end lie inside a floor polygon of their level; per map, move the S10 spawn onto the ground floor and put the WSC ring road into `floorPolygons`. Tracked: item 11; survey family A; fixes on `origin/claude/wip/item2e-map-logic-laptop` (wsc-walkable-report, lk-road).

**2. D1 - Stairs chain: `afterPartyMove` fires later links at the arrival cell.**
Count: 56 of 348 activations on 7 maps (34 land on the wrong level, 22 fire 2 to 8 times); 54 of 174 links do not round-trip. Status: confirmed (the exact port equals the runtime status lines; code read: the `break` leaves only the inner `[from,to]` loop; hand: Death House spiral ends all at (25.5,27.5) on f1/f2/f3 in array order; K lk-k20-* six links all at (180,145)). What a table sees: taking any stairs in a multi-floor building lands the party on the wrong floor. Examples: ch04/K lk-k18-court fires 8 times ground -> high-peak, lk-k20-court 6 times ground -> north-peak; ch07/Q Q14-n-1 ground -> third; appB/death-house lk-spiral-1-2 f1 -> f3; ch12/W W11-down ground -> upper; ch06/O O-stair-1 O1L -> O4L. Smallest fix: engine, return from `afterPartyMove` after one transition and have `takeLink` bypass the proximity loop. Tracked: item 11 (single-hop); ChatGPT item11-transition-report; fix on `origin/claude/wip/item11-vertical-transitions-cloud` (unmerged).

### Major

**3. B1 - Door fully covered by a collinear normal wall: opening it changes nothing.**
Count: 32 doors on 6 maps (E5 5, K 6 incl. 4 secret, N2 9, N3 6, N4 4, N6 2); 24 unpassable when open. Status: confirmed (hand: E5 ground-w-52 covered 2.5+2.5 ft by w-30/w-31; N2d-kitchen under the 27.5-ft ground-w-50; N3h-f and N3g-hall under the 92.5-ft ground-w-1; N6b-a under the 50-ft w-51; the same doors as ChatGPT, door for door). What a table sees: players open the door and still cannot walk through. Examples: ch05/N2 upper (6 doors); ch03/E5 ground (all 5 church doors); ch05/N3 upper (4); ch05/N4 ground N4c-pantry-door and the closet-stair secret door; ch05/N6 ground N6b-a, N6c-a. Smallest fix: `authorlib.build_walls` (and `import-ml.py`) cut the covered span out of every collinear blocking wall when a door is stamped; assert no door has a collinear blocker over more than 0.1 ft. Tracked: survey family B; item 6 G14/G11; item6-map-groups vallaki issue 2, village-castle issue 1; ChatGPT wall-topology-report (fix on branch, unmerged).

**4. C1 - Rooms sealed by the door defects or by missing door records.**
Count: 55 rooms on 6 maps (N3 16, N4 11, N2 9, N1 5 plus the start room, N6 5, E5 4). Status: confirmed (the `canWalk` retest equals the 2.5-ft BFS; hand: N1 has 0 door records among 28 walls; N6 ground doors covered and N6-front opens onto no floor). What a table sees: the Vallaki interiors and the village church cannot be played room to room. Examples: ch05/N1 ground (party starts inside sealed N1f, the yard cut off); ch05/N3 (16 of 23 rooms); ch05/N4 (11 of 28); ch05/N6 (5 of 8); ch03/E5 nave E5f with the party inside, E5a-c, E5g. Smallest fix: falls out of B1/B3/B5; generator assertion that with every door open every room is reachable from the entry start or a link end unless flagged sealed. Tracked: survey family C; item 6 G14.

**5. C3 - Castle rooms with no door at all, or doors only among themselves.**
Count: about 40 rooms on ch04/K (dungeon 22, ground 13, weeping 13, court 7, spires 2, tower-roofs 1 of the 59 unreached). Status: confirmed (hand: K73's only doors sit on its own north and south edges, none to the corridor). What a table sees: no start or link reaches these rooms; the DM places the party by hand. Examples: dungeon prison cluster K73-K78; ground approach K1-K4 (into K3 only, never the hall); K6, K12-*, K13-*, K22, K35, K41, K43, K46-*, K53-*, K58 with no door. Smallest fix: per map in `castle-ravenloft.py`, a door from K73 to its corridor, from the approach into the hall, the K22/K28 doors; a sealed flag for rooms meant closed. Tracked: survey family C; item6-map-groups village-castle issue 2; item 6 G16; item 2g on `claude/wip/castle-playable`.

**6. A2 - Party created on levels[0] while the view opens on scene.entry.**
Count: 2 scenes (ch04/K, ch05/N4). Status: confirmed (runtime party.level differs from the viewed level; hand: K levels[0] = dungeon, entry = ground; N4 levels[0] = cellar). What a table sees: the DM opens the castle or the house to an empty floor; Players see the wrong floor until someone finds the token. Smallest fix: engine, `ensureDefaultToken` uses the entry level's first room when there is no spawn; or generator, every multi-level scene gets a spawn on its entry level. Tracked: survey family A only. New to the queue.

**7. D4 - Link arrives off the floor as authored.**
Count: 16 arrivals on 9 maps at 0.3.1 (7 with no 5-ft departure); 12 on 8 maps at 0.3.2 (V's lifts now on floor). Status: confirmed (static equals runtime onFloor; hand: lk-road to (132.5,-7.5); T-stair to (253,360) in the stair opening; E5 undercroft to (35,38); R-ledge-steps to (343.8,87.4)). What a table sees: the party is stranded after the stairs until the DM moves it. Examples: ch08/S10 lk-road (stuck); ch09/T T-stair (stuck); ch02/R R-ledge-steps, R-shelf-climb (notch level unreachable); ch03/E5 lk-ground-undercroft (undercroft unreachable); ch04/K lk-k51 (stuck); ch12/W W13, W16-hole. Smallest fix: generator assertion that both ends of every link lie inside a floor polygon with one free 5-ft step; per-map moves for the 12 remaining. Tracked: survey D3; ChatGPT snappedLinkArrivals / published-coverage-audit; six landing repairs on branch; V fixed by 0.3.2.

**8. D3 - Link markers dropped by the 12-ft one-marker rule.**
Count: 48 endpoints on 8 maps (K 27, death-house 6, Q 4, W 4, 03-compound 2, V 2, O 2, X 1); 7 scenes lose a whole destination (K 12, death-house 3, O 2, 03-compound 2, Q 1, W 1, V 1). Status: confirmed (code read `app.ts` about lines 401-403: under 12 ft, the first link in array order wins whatever its destination). What a table sees: a floor can only be reached by stepping on a hidden endpoint (which then chains) or by the DM. Examples: ch04/K; appB/death-house f2 -> f3, f3 -> attic, dumbwaiter f2 -> f1; ch06/O O2L -> O3L, O3L -> O4L; wsc/03-compound L1 -> L2, L2 -> L3. Smallest fix: engine, one marker per destination per 12 ft, or one stacked marker listing every destination. Tracked: survey D4; ChatGPT item11-followup marker-suppression ledger.

**9. D2 - First step off a landing re-fires the same link.**
Count: 172 of 348 arrivals, on every scene with stacked stairs. Status: likely (pure geometry: 3.54-ft arrival offset against a 5.5-ft trigger and 5-ft cells; not run in the browser). What a table sees: players bounce between floors trying to walk away from a stair. Worst: ch04/K, appB/death-house, ch07/Q, ch06/O, wsc/03-compound. The context-menu "Move party here" caller (`main.ts:563`) has the same mechanism. Smallest fix: engine, a link fires only when the party enters its trigger (was outside before the move); the same check for the UI caller. Tracked: survey D5; ChatGPT item11-followup-report "walk-off" case.

**10. C2 - Rooms unreachable because their door opens onto ground that is not floor.**
Count: 11 rooms on 5 maps plus all 6 rooms of wsc/02-street. Status: confirmed (hand: the WSC grids hold exactly the keyed rooms; K11-c/K30/K40/K42 doors open onto no polygon). What a table sees: whole outbuildings and the square are unreachable. Examples: wsc/02-street S1-S6; wsc/03-compound L0-2, L0-3, L0-4 (the party can never leave the tower on L0); wsc/01-tavern T6; ch05/N6 N6c; ch05/N3 N3p; ch04/K K11-c, K30, K40, K42. Smallest fix: same as A1/B3: derive `floorPolygons` from the drawn walkable terrain minus buildings (`wsc-town.py`, `noke-tower.py` first; castle courtyards). Tracked: wsc-walkable-report (branch); survey A root cause 3.

**11. F3 - Drawn walkable ground outside the movement floor.**
Count: 9 levels on 8 maps (02-street 78%, 03-compound 79%, M shelf 69%, tavern 46%, K ground 44%, D river 85%, R river 92%, M fog 83%, J 32%). Status: confirmed for the WSC maps; likely elsewhere (5-20-ft samples; far banks and mountain slopes may be meant unreachable). What a table sees: the party cannot step onto ground the map plainly shows. Smallest fix: generator rule deriving `floorPolygons` from the drawn terrain; the map contract reports the fraction per level. Tracked: wsc-walkable-report (branch) for WSC; new for M, K, D, R, J.

**12. E2 - Entry level floats above land flattened to a lower levels[0].**
Count: 5 maps (F 25 ft, M 40 ft, P 24 ft at the start and 31 ft at two room centroids, D 7 ft, R 6 ft). Status: confirmed (analytic equals runtime groundAt at the start; hand: F levels[0] = low at -25 ft with entry day at 0; M fog -40; D river -7; R river -6). What a table sees: the floor the party walks hangs over the drawn land at the map edge. Smallest fix: engine, flatten to the entry level, not levels[0]; a neighbour's band never modifies the land inside another footprint (`worldland.ts` `height()`). Tracked: new (the P-N band overlap itself is an atlas warning and in the item 2e plan).

**13. E1 - Open-air level buried under land flattened to levels[0].**
Count: 3 levels on 2 maps (H pool 960 ft, H ledge 580 ft, P river 10 ft). Status: confirmed (analytic equals runtime groundAt within 0.1 ft). What a table sees: the canyon floor and the riverbed are drawn under solid land. Smallest fix: engine, flatten to the viewed level or cut the land where a lower open-air level has terrain (framework release 7); per map, a ground cut for H's pool. Tracked: ChatGPT allmap-audit-report "Visible terrain" (H canyon fill); not in the queue.

**14. E3 - Yester Hill is flat at 0.3.1; at 0.3.2 five flat levels joined by stairs jumps.**
Count: 1 map. Status: confirmed on both commits (runtime at 0.3.1 flat and flush). What a table sees: at 0.3.1 the summit is unreachable; at 0.3.2 the climb is four teleports of 153-542 ft behind 120 invisible walls (hill 0 ft, slope-low 94.5, slope-high 178.1, outer 254.5, summit 272). Smallest fix: framework release 7, ground-following levels with Y rebuilt as one sloped level. Tracked: item 7; item7-open block 1; MAPS-FRAMEWORK question 3.

**15. F1 - Blocking walls pass through on-floor lattice nodes: the wall can leak.**
Count: 20 levels on 14 maps; S10 ground 13 walls / 45 nodes, S village 3 walls / 181 nodes. Status: confirmed geometry (hand: S10 ground-w-40 passes through node (131.25,123.75), which is on the floor); the leak is likely (ChatGPT reproduced 39 of 108 on main). What a table sees: players walk through a wall or a closed door where the wall meets a node. Examples: ch08/S10 ground; ch08/S kw-1, kw-5; ch07/Q six levels incl. the Q51 doors; ch06/O and ch11/V every level; ch04/K ground/spires/south-tower. Smallest fix: engine, make the crossing test inclusive at the step endpoints (or offset the lattice per level), with ChatGPT's unit test. Tracked: ChatGPT movement-blocker-report (fix on branch, unmerged); survey family F; item 14 G04.

**16. F2 - Invalid polygons: repeated vertices, zero-length edges, rings touching themselves.**
Count: 25 rings on 10 maps at 0.3.1 (D 14, R 7, X 6, H 4, V 4, W 4, I 3, J 3, Y 2, P 1); 21 on 9 maps at 0.3.2. Status: confirmed (hand: W ground floorPolygon #12 visits (55,120) and (55,330) twice; D river vertex on its own edge; X lower X31/X31a/X31b repeat a vertex; H pool zero-length edges; V5/V6 fixed at 0.3.2). What a table sees: movement and drawing can differ along the fold. Smallest fix: generator assertion in `authorlib`/`wildlib` that every polygon is simple with no repeated vertex; the same check in `audit-outdoor.py`. Tracked: ChatGPT allmap-audit-inventory polygonValidity (branch); V on item 7.

**17. C5 - Level with no start and no incoming link end.**
Count: 2 levels at 0.3.1 (ch09/T gate-top, ch14/Y summit); 1 at 0.3.2 (T gate-top). Status: confirmed. What a table sees: Players can never climb there. Smallest fix: generator assertion that every level has a spawn or an incoming link end; per map, a T stair to the gate top. Tracked: item6-map-groups tsolenka issue 1; item 7 (Y).

**18. C6 - Krezk ledge: S7-S9 not connected to the switchback landing.**
Count: 1 level, 3 rooms, 14,356 ft2 (76 of 2,373 nodes reached). Status: likely (one static method; a 2.5-ft gap could join them). What a table sees: the abbey approach on the Krezk map cannot be walked. Smallest fix: a runtime walk from lk-switchback's landing to S7; if confirmed, open the terrain wall between them in `krezk-abbey.py`. New.

**19. B5 - Windows block movement and seal rooms whose only other boundary is a window.**
Count: 2 rooms on ch05/N4 (N4c, N4d). Status: likely (5-ft flood only; matches ChatGPT's two windows and the survey's sealed N4d). What a table sees: two rooms of the house cannot be entered. Smallest fix: restore the N4 doors the generator dropped; a lost door fails the build. Tracked: item 6 G14; ChatGPT vallaki-apertures-report.

**20. D6 - Arrival cell boxed in by closed doors as authored.**
Count: 4 arrivals on 3 maps (appB/death-house lk-21 -> attic; ch08/S lk-ladder-a; ch12/W W9-west, W9-east). Status: likely. What a table sees: players arrive and cannot move until they find the door. Smallest fix: generator assertion that an arrival cell has one free 5-ft step with doors as authored. Tracked: partly, item6-map-groups death-house issue 1.

**21. B2 - Door crossed by the end of another blocking wall.**
Count: 8 Castle doors (3 unpassable when open: K75-door, K74d-bars, K74c-bars; 5 minor). Status: likely (static only; ChatGPT saw 3). Examples: ch04/K dungeon K75-door crossed by dungeon-w-17; weeping K37-north-b by weeping-w-7; ground K11-door by ground-w-572. Smallest fix: assertion that no blocking wall intersects a door's interior; trim the castle partition ends in `castle-ravenloft.py`. Tracked: partly, ChatGPT doorApertures; item 2g.

**22. H1 - Placement footprint is the first level with terrain, which may be a small patch.**
Count: 5 maps (S10 4% of the map, death-house 16%, H 38%, M 40%, X 46%). Status: confirmed (hand: S10 levels[0] = valley, one 40x40 room with terrain; the abbey lies 140-201 ft beyond it). What a table sees: the map sits on unflattened apron and the atlas size warning cannot catch it. Smallest fix: `frames.ts` footprint = union of every level's floor bbox (or the entry level's). New.

### Minor

**23. B3 - Door with floor on one side only.** 43 doors (K 30; 13 on 9 other maps). Confirmed (equals ChatGPT's notProbed door for door). The party opens the door but never steps through; on the WSC maps this is why the start cannot reach the other buildings. Examples: ch04/K weeping (11), court (8); wsc/03-compound tower/hut/outhouse doors; wsc/01-tavern tavern-front, stable-door; ch05/N6 N6-front; ch08/S10 S17-door. Fix: every door needs floor within 2 ft on both sides, the partial Castle excepted by a flag. Tracked: ChatGPT doorApertures.notProbed (47); survey A root cause 3.

**24. B4 - Closed door can be walked round through a gap beside it.** 27 doors on 11 maps. Doubtful (archways legitimately bypass a door; needs the F1 leak test and a runtime walk). Examples: ch07/Q ground Q2-doors, Q3-Q4-e/w (the 138-ft open boundary); appB/death-house attic-closet secret doors; ch08/S10 ground S10/S11; ch04/K K15-west, K54-door. Fix: nothing until a runtime walk sorts archway from leak. Tracked: partly, item6-map-groups argynvostholt issue 1, death-house issue 1.

**25. C8 - Rooms reachable only through a locked door.** 37 rooms on 7 maps (K cells 16, S10 S12c cells 9, death-house attic 20 and 23C-23F, Q16/Q27/Q28, X33b/e/f, N5c). Confirmed; by design. Fix: the map contract counts them reachable and names the lock (MAPS-FRAMEWORK question 5). New as a list.

**26. C4 - Closed rooms plausibly intended.** 12 rooms on 3 maps (K31a, K82, K83-l shafts; N5d; N9d-N9i wagons). Likely (the 2.5-ft lattice, the engine's, cannot enter them). Fix: a sealed flag on the room record; restore N5d's door if G14 says it existed. Tracked: survey C notes; item 6 G14.

**27. D5 - Arrival pushed off the floor by snapping with the default [0,0] grid origin.** 8 arrivals on 7 maps; ch13/X X-fissure has no departure (stuck, so major there). Confirmed (hand: X-fissure raw (24.5,258) on floor, cell (22.5,257.5) off). Others: ch02/D D-beach, D-wash; ch02/F F-gallows-stair; ch02/P P-pier; ch02/R R-bridge-east; ch08/S lk-ladder-j; ch11/V V-scaffold-2. Fix: snap with the level's grid origin and fall back to the raw endpoint when the cell centre is off the floor. Tracked: survey D2.

**28. D7 - Same-level Castle passages: `takeLink` picks the wrong end.** 5 links on ch04/K dungeon (lk-k80, lk-k82, lk-k85, lk-k86, lk-k87). Confirmed by code read. Clicking the far marker sends the party back where it stands. Fix: when both ends share the level pick the nearer end as here; or a distinct passage kind. Tracked: item6-map-groups village-castle issue 2.

**29. D8 - Stairs/trapdoor links with ends more than 60 ft apart in plan.** 8 links on 6 maps. Numbers confirmed; intent doubtful for the wilderness trails. appB/death-house lk-30 (66.6 ft) and lk-trapdoor (60.1 ft) look like real mismatches; ch08/S10 lk-road 239 ft, ch02/M M-cleft 216 ft, ch08/S lk-switchback 202 ft, ch15/Z Z-tunnel 167 ft are the convention. Fix: report over 60 ft; move the two Death House ends to their drawn stairs. New (Death House); framework release 7 for the rest.

**30. A3 - Two spawn objects on ch14/Y; the summit one is dead.** Confirmed on both commits. Fix: assert at most one spawn per scene. New.

**31. C7 - Small orphan floor components outdoors.** 3 slivers (ch02/I day 1,888 ft2; ch15/Z den 588 ft2; ch02/J ground 225 ft2). Likely. Fix: generator report of floor components not connected to the start. New.

**32. F4 - Grid origin off the engine's [0,0] lattice.** ch10/U cellar, origin [915,1772]. Confirmed. Arrivals land 2 ft off the drawn cells. Fix: same as D5. Tracked: survey D2.

**33. H2 - Flatten bands of two maps overlap.** ch02/P with ch05/N (31 ft inside P at two centroids), ch02/L with ch05/N. Confirmed (runtime P +23.7 ft at the start). Fix: a band never modifies the land inside another footprint. Tracked: `manifests/world-atlas.json` bandOverlaps; item 2e plan.

**34. H3 - Child maps larger than their plot room.** 10 children (N1 8.24x, N5 4.52x, N3 4.29x, N4 4.27x, N2 3.57x, N6 3.16x, death-house 2.09x, E5 2x) plus N8 covering parent room N8c. Confirmed. Fix: design decision, shrink the interiors or enlarge the plots. Tracked: atlas warnings; docs/WORLD.md; item6-map-groups vallaki issue 1.

**35. H4 - Pins that contradict the fiction.** ch02/J 4,598 ft from and 584 ft below ch04/K; wsc/01-tavern one hex from wsc/02-street, which carries a tavern-front door; ch02/B and ch02/D at two pins. Likely (atlas numbers). Fix: design decision. Tracked: item 2e plan; docs/WORLD.md.

### Nits

**36. D9 - Link joins two levels that are not in one stackOf group.** 9 links on 5 maps (death-house lk-21, lk-trapdoor; H H-rope, H-gully, H-fall; L L-dive, L-dive-pine; E5 lk-ground-undercroft; Z Z-tunnel). Cosmetic in the level stack. New.

**37. E6 - Below-ground levels under the land (expected); whether the land is hidden when viewed.** 7 cellars and 4 below-ground outdoor levels on 9 maps (K dungeon -80 ft, N4 cellar -11, L lakebed -40, J ledge -35, E5 undercroft -13). Not measured (the runtime pass had no camera check). Tracked: item6-map-groups backdrop issue 1.

### Reported elsewhere, not reproduced on main

**38. E4 - Amber Temple upper and lower levels buried.** 0 reproduced on `90cfa32`: the atlas ground cuts hold the land under both levels (upper +32 ft, lower +2 ft, analytic and runtime agree). item7-open block 2 describes the branch's snow scenery, which is props and invisible to the analytic field. Next: a raycast against the drawn snow props on 0.3.2. Tracked: item7-open block 2.

**39. E5 - Vistani camp buried 58 ft.** 0 reproduced: analytic land flush, runtime +0.6 ft at the start. ChatGPT measured the drawn mesh between vertices, which neither stage can see. Next: a raycast probe on the drawn mesh at every room centroid. Tracked: ChatGPT land-footprint-report (fixed on branch).

**40. Note on the moving main.** The static stages and the runtime read `90cfa32` (0.3.1); main moved to `55def97` (0.3.2) during the audit. Spot check: V lifts and V5/V6 fixed; Y now five fenced levels with four stairs jumps; X, W, U findings unchanged.

Dropped as out of scope or not a map fault: room label anchors outside their polygon (looks); secret-door walls without an `open` field and the ch02/C hex grid (no table effect); the audit's own surrogate starts on non-entry levels; ch02/R bench 70% walkable (the far bank is reached by the fords); wall endpoints off the 2.5-ft half-grid; software-rendering timings.

## Already tracked, with the numbers compared

- **Item 11 (QUEUE):** "players can't move anywhere; door logic seems broken", the Abbey case, and 56 wrong destinations / 22 multiple transitions across 346 activations. This audit agrees: A1 reproduces the Abbey and adds wsc/02-street; D1 reproduces 56 of 348 (34 wrong level + 22 multiple; the two extra activations are same-level K passages counted here). "Door logic seems broken" resolves into three distinct causes, B1 (door under a wall), B3 (door to no floor) and C1 (rooms sealed by them), none of which item 11 names.
- **ChatGPT's all-map reports** (`allmap-audit-report.md`, `allmap-movement-coverage.json`, on the item 2e branches): Players movement 42/44 agrees with A1 (the two failures are the same maps). doorApertures: 25 collinear + 3 crossing; this audit finds 32 collinear (the 7 extra are K secret doors and N4's, which the engine still blocks) and 8 crossing (5 more, all K, minor). notProbed 47 against B3's 43 (ChatGPT counts 4 doors this audit treats as B1). Visible terrain: H canyon fill agrees (E1); N9 58-ft burial not reproduced (E5). polygonValidity: 25 on 8 maps against 25 rings on 10 maps here (H and P added; the counting unit differs).
- **ChatGPT's item11-transition-report and followup:** the per-map wrong-level figures match exactly (K 32, Q 7, death-house 4, W 4, O 3, V 3, 03-compound 3). The marker-suppression ledger (48 endpoints) matches D3. The "walk-off" case is D2; this audit puts a number on it (172 of 348 arrivals) but did not run it.
- **The framework survey (`mapfw/survey-logic.md`, families A-G):** every family is reproduced. Differences: the survey's 59 sealed rooms (K 20, N3 10, N9 8, N1 6, N4 6, N2 4, E5 2, N5 1, T 1) become 55 (C1) + about 40 (C3) + 12 (C4) + 2 (C5) here because the retest opens every door and counts link ends as starts; S3-chamber is confirmed a false positive and dropped; the survey's "chain hazard" 75 is replaced by the measured D1/D2 figures.
- **item7-open.md:** block 1 (Yester Hill flat) agrees, with the 0.3.2 state added (E3). Block 2 (Amber buried) does not reproduce on main (E4): the burial was the branch's snow scenery, and a raycast on 0.3.2 is the only way to settle it.
- **item6-map-groups.json:** vallaki issue 2 (N6 2, N2 11 overlapped doors) agrees on N6, this audit counts N2 at 9; village-castle issue 1 (E5 11 doors) is 5 collinear here (the other 6 are B3/B4); argynvostholt issue 1 and death-house issue 1 are B4/D6; tsolenka issue 1 is C5 + D4; backdrop issue 1 is E6 (not measured).

## The three fixes that clear the most

1. **Generator contract in `authorlib` (one release, no map redesign):** spawn and every link end inside a floor polygon with one free 5-ft step; at most one spawn, on the entry level; every level has a spawn or an incoming link end; no collinear blocker over a door, no wall through a door's interior; floor within 2 ft on both sides of a door unless flagged; every room reachable with doors open unless flagged sealed; every polygon simple. Clears A1, A2, A3, B1, B2, B3, B5, C1, C5, D4, D6, F2 and most of C2 and C3 once the per-map corrections it forces are made. Maps: S10, 02-street, K, N1-N6, E5, T, Y, R, W, D, X, H, V, I, J, P.
2. **Engine, the vertical-link loop (`app.ts`):** one hop per move; a link fires only on entering its trigger; one marker per destination; snap with the level's grid origin and fall back to the raw endpoint; nearer end as "here" for same-level links. Clears D1, D2, D3, D5, D7, F4 and the context-menu caller. Maps: K, death-house, Q, W, O, V, 03-compound, X, D, F, P, R, S, U.
3. **Engine, land and floor (`worldland.ts`, `frames.ts`, `movement.ts`):** flatten to the entry level and cut the land where a lower open-air level has terrain; footprint = union of every level; a band never modifies the land inside another footprint; inclusive crossing test at the step endpoints; `floorPolygons` derived from the drawn terrain in `wsc-town.py` and `noke-tower.py`. Clears E1, E2, H1, H2, F1, F3 and the WSC half of C2. Maps: H, P, F, M, D, R, S10, death-house, X, S, Q, O, V, K, 01-tavern, 02-street, 03-compound.

Yester Hill (E3) and the Castle's missing doors (C3) stay per-map work: framework release 7 and item 2g.

## For Matt to decide

1. A2: when a scene has no spawn, should the party start on the entry level's first room (engine change) rather than levels[0]? Yes/no.
2. C3/C4: may the generator carry a "sealed on purpose" flag so shafts (K31a, K82, K83-l), wagons (N9d-N9i, N5d) and unbuilt castle rooms stop counting as faults, with the rest failing the build? Yes/no. (MAPS-FRAMEWORK question 4.)
3. C8: do rooms behind a locked door count as reachable, with the lock listed? Yes/no. (MAPS-FRAMEWORK question 5.)
4. E2/E1: should the land flatten to the entry level instead of levels[0] (F, M, P, D, R stop floating; H pool and P river stop being buried)? Yes/no.
5. H1: should the placement footprint be the union of every level's floor (S10's abbey, death-house, H, M, X), accepting that the atlas size warnings will fire for them? Yes/no.
6. F3: should the WSC generators derive floor from the drawn ground (making the yards, roads and square walkable) ahead of ChatGPT's 0.3.3, or wait for its branch? Ahead/wait.
7. C6: may a runtime walk be run on ch08/S to confirm the ledge split before anyone edits `krezk-abbey.py`? Yes/no.
8. D8: should the two Death House long links (lk-30, lk-trapdoor) move to their drawn stairs? Yes/no.
9. E4/E5: should the land probe be re-run on 0.3.2 with a raycast against the drawn mesh (snow props, apron rings) before the Amber and Vistani burial entries are kept in the register? Yes/no.

## Evidence

All under `/tmp/claude-0/-home-user-VTT/3e57a1ac-07da-5111-aa9e-cccc471b7481/scratchpad/`:

- `maplogic/scout/scout.md`: the inventory of 45 scenes and the known register.
- `maplogic/static-a/static_a.py`, `results.json`, `findings.md`: starts, first steps, doors (collinear and crossing blockers, floor both sides), rooms by `canWalk` with doors open, locked-only rooms.
- `maplogic/static-b/static_b.py`, `permap.json`, `findings.md`: 2.5-ft lattice BFS of every level from the start and every link end; link round trips, arrival cells, markers, stackOf, orphan components.
- `maplogic/static-c/static_c.py`, `results.json`, `findings.md`: analytic land height per level, footprints, bands, polygon validity, drawn ground against floor, grid origins, atlas placement.
- `maplogic/runtime/runtime.cjs`, `results.json`, `findings.md`, `run.log`: one headless Chromium against `http://localhost:4820/`, every scene: party level against the viewed level, onFloor, eight steps, every link activation, groundAt at the start.
- `maplogic/verify/sample.py`, `sample2.py`, `sample3.py`, `verified.md`, `scorecard.json`: the hand-checked sample per family, the 0.3.2 spot check and the scorecard data.
- `mapfw/survey-logic.md`, `survey_logic.py`, `survey_logic.out`: the framework survey this audit extended.
