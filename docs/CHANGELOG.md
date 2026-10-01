# Changelog

## M0 Foundations — 2026-09-29

- Vite + TypeScript + three.js PWA shell (manifest, service worker, offline cache-first), iPad-first touch.
- Docs: `UNITS.md`, `SLIDER.md`, `STYLE.md`, `PIPELINE.md`.
- Core (pure, unit-tested): units and footprints, square/hex grid math (5 ft and 5-10-5 diagonals),
  slider curves and visibility classes, the 5e light and vision model (PHB presets, darkvision, cones,
  Foundry-style wall flags), 1-ft explored/visible coverage maps, PHB travel pace.
- Renderer: procedural low-poly kit v0 in the palette, coverage fog injected into every material,
  floor-only grid overlay (square and pointy/flat hex) clipped to `grid.json` polygons, secret doors that
  are pixel-identical to wall at t = 0, low/full wall toggle, tabletop/top-down cameras, CSS labels.
- DM tools: view slider (detents, peek, keyboard), reveal/hide room, object or secret door, paint reveal/fog,
  door toggles, undo, token drag with snapped distance readout. Campaign state in IndexedDB.
- Player Display (`?display=player`) over BroadcastChannel: pinned at t = 0, camera follows the DM, no DM UI.
- Manifests seeded from the prompt: 37 locations / 529 area keys, 174 characters, encounter terrain + events.
- Book pipeline: `npm run ocr` (tesseract @ 300 DPI) and `scripts/manifest-report.ts` (flags mismatches).
- Tests: 40 Vitest unit tests (+2 todo waiting on OCR/M2) and 21 Playwright acceptance tests (grid-on-floor
  pixel proof in 16 camera/wall/grid/slider combos, secret-door pixel identity, slider 0/0.5/1, Player
  Display isolation, reveal persistence).

## Book verification — 2026-09-30

- Book scanned into `reference/module/` (local only), OCR'd with `npm run ocr` (258 pages, ~9 min).
- `scripts/manifest-report.ts` hardened for real OCR: small-caps sub-letters (E5r → E5f), O/l digit
  confusions (QOl3 → Q13), fuzzy name match, Appendix B-only numbered keys, printed page = PDF page − 1.
- `manifests/locations.json`: printed pages filled for 476 area keys; added E6 Cemetery and E7 Haunted
  House (village keys missing from the seed); named K31a Elevator Shaft and K31b Shaft Access.
- 46 keys whose headings the OCR couldn't read (mostly Argynvostholt Q19–Q53, some Vallaki interiors) keep
  `page: null`; they get pages when their chapter is modeled.

## M1 Death House — 2026-09-30

- `locations/appB/death-house/`: all 38 keyed areas (plus the book's lettered sub-areas 1A–25E, 63 keys) across
  six levels: first, second, third floor, attic, dungeon, lower dungeon. Authored from the p.216 map at its
  printed scale (one square = 5 ft) by `scripts/authoring/death-house.py` (cells → feet; walls derived from
  room polygons, then doors, windows, openings, railings and secret doors stamped over them).
- Wired: 5 secret/concealed doors, the hidden spiked pit (26), the hidden trapdoor (3/32), the padlocked
  door (20), the portcullis (37), crypt slabs, 20 hidden-creature slots (broom, specter, animated armor,
  Rose & Thorn, centipedes, grick, 4 ghouls, 5 shadows, mimic, 2 ghasts, Lorghoth), ~35 hidden-object
  slots (chests, relic niches, remains, keys), page refs on every key, vertical links (spiral stair, attic
  stair, the 21 shaft, dumbwaiter, trapdoor, stairs to 35), a party spawn in the portico.
- Kit v1 props: spiral stair, fireplace, chairs, bookshelves, desk, wardrobe, stoves, oven, crib,
  harpsichord, harp, armor, statue, altar, well, portcullis, ledges, octagonal dais, pallets, niches, trunks,
  cabinets, sheeted furniture, refuse mound, trapdoors, gate, wheel, skeletons, pit cover, dollhouse, lamps,
  dumbwaiter. Straight stairs can now run along x.
- Schema: per-level `ambient` (house `interior-dim`, dungeon `darkness`) and `north` (this map prints north
  to the left); `spawn` objects; `dumbwaiter` links.
- The default party token carries a torch (20/40) so unlit levels are playable immediately.
- Tests: scale acceptance for area 38 (forty-foot square = 8 × 8 cells); manifest ↔ scene no-orphan check
  covers all 63 Death House keys; Playwright grid-on-floor and slider suites now run on the test room, Death
  House second floor and the lower dungeon (63 acceptance tests).
- Known: draw calls on the dungeon level are ~170 (props are separate meshes); instancing lands with M4's
  performance pass. Room labels overlap at DM view on dense levels; label declutter is queued for M9.

## M1.1 Characterization pass — 2026-09-30

- Kit v2 (`app/src/kit/creatures.ts`, `props.ts`): a modular low-poly humanoid (skin, cloth, hunch, claws,
  robe, cloak, wolf-helm, weapons) with ghoul, ghast, cultist, adventurer and animated-armor variants;
  translucent ghosts, specter and shadows; the mimic as a door with a maw; Lorghoth as a shambling mound;
  the grick; insect swarm; the broom; wolves (live and stuffed). The party token is now an adventurer.
- Death House props now follow the room descriptions: wrought-iron gate and chained oil lamps (1A), the
  Durst coat-of-arms and portraits (1B), black marble fireplace and the longsword (2A), cloaks and top hat
  (2B), stag's head, three stuffed wolves, fur chairs, cask and candelabrum, chandelier (3), the domed oven
  and stocked shelves (4), crystal chandelier, red silk drapes, tapestry and painting (5), suits of armor
  with wolf helms and the family portrait (6), the floor-to-ceiling shelves, ladder and windmill picture
  (8), the clawed-foot chest with the skeleton (9), brass chandelier, stained-glass hangings, harpsichord
  and harp (10), four-poster beds, vanity and mirror, tiger rug, burgundy drapes (12), clawed tub, stove and
  spigot barrel (13), the shrouded crib (15B), ivy-framed mirror (15A), child beds, the two small skeletons,
  windmill toy chest and dollhouse (20), sheeted furniture (18), the doll in the window (17); earthen
  tunnels with timber braces every 5 ft and wooden posts (dungeon), slabs and biers (23), the well (25),
  benches and strewn bones (27), the Strahd statue with the wolf and the shackled skeletons (31), the
  ghoul-carved altar with hanging chains, pillars, ledges and dais (38), shackles in the prison alcoves (36).
- Cobwebs on the third floor, attic and dungeon; wall materials `paneling`, `paneling-dusty`, `earth`, `brick`.
- UI: label density toggle (keys / all / none), default keys only.
- Tests: acceptance diff threshold raised from 2 to 6 levels (transparent-sort blending noise); 63 e2e green.

## M1.2 Run mode — 2026-09-30

- DM / Players switch on one screen: Players mode pins the view to t = 0 and hides every DM affordance
  (slider, tools, labels, finder); DM mode restores them. The separate Player Display window remains.
- Token-driven play: moving the party token reveals and remembers the room it enters (`autoReveal`),
  stepping within a cell of a stair / trapdoor / dumbwaiter endpoint changes level, the camera follows
  (`follow`, toggle in the camera cluster). Level tabs show a dot where the party is.
- Camera rig: fixed tabletop tilt (45°) or top-down, yaw in 90° steps (buttons, R / Shift-R), drag to pan,
  pinch / scroll to zoom, zoom buttons, "find the party" (F), double-tap a room to frame it, damped motion.
- Find any area: search box (/) jumps to a key or name across levels; Rooms sheet lists every key per level
  with page ref, revealed state (eye toggles reveal / hide) and the party's room highlighted.
- Readability: DM work-light scales with the slider (players keep the true darkness), doors in warm wood
  with a red band when locked, lighter floors, smaller key pills, level names shortened, first-run help.
- docs/SLIDER.md: Players mode documented alongside the Player Display.

## M1.3 Affordances + M2 seeds — 2026-09-30

- Right-drag / two-finger twist rotates the camera freely; the buttons still turn in 90° steps.
- Every door carries a tappable marker (open/closed/locked); every stair, trapdoor and dumbwaiter end carries a
  level marker that moves the party. Tapping a room, door or secret door opens a menu of what you can do.
- Info card: tapping any asset in DM mode shows its name, area key and page, a player-facing description, DM
  notes, its visibility state and actions; in Players mode only the description, and only if it is in view.
  Death House carries 83 descriptions / 88 DM notes (own wording) plus generic descriptions by kind.
- Breathing room: 45° tabletop framing from further back, 40° FOV, walls 0.7 ft, smaller labels.
- Imported the uploaded seed locations via `scripts/authoring/import-ml.py`: Church E5 (ground + undercroft,
  E5a–E5g), Tser Pool Encampment (G), Svalich Woods road kit (C), Village of Barovia placement layer (E1–E7).
  Outdoor kit: pines, bushes, dead trees, boulders, gravestones, fences, water, tents, wagons, signposts,
  braziers, houses, church massing, gate arch; horses, scarecrow, vampire spawn, gargoyle, wyrmling.
- Schema: `terrain` (unkeyed ground floors), `placementFt` / `kind: placement` (no fog, no grid).
- Scatter props merge into one mesh per material (road kit 678 → 74 draw calls).
- 151 character figure recipes (skin, cloth, hair, hat, weapon) attached to `manifests/characters.json`.

## M1.4 Scale and atmosphere — 2026-09-30

- Walls and doors keep their real height. The low-walls view is now a cutaway: a clipping plane trims
  everything above 5 ft over the floor instead of squashing the wall group, so doors stay door-sized.
- Tighter, closer camera (30° field of view) with room around the framed level; walls 0.6 ft thick.
- Atmosphere: soft background gradient, exponential ground fog, and a mist floor that follows the
  current level's elevation (no longer covering the dungeon). Lighter floor and wall palette; softer grid.
- Instant camera moves cancel any glide still in flight (fixed a timing-dependent grid test failure).
- Esc closes the help sheet and other sheets.

## M1.5 Player-side rules — 2026-09-30

- Moving is two deliberate taps: tap a token to pick it up (white ring), then tap where it goes. Tap it
  again or press Esc to cancel. Swiping from a token pans the camera instead of moving anyone. With a
  mouse, a ghost ring and the distance preview the landing cell.
- Players' side (Players view and the Player Display) walks: `core/movement.ts` searches a 2.5-ft
  lattice over the floor and never crosses a wall, window, closed door or undiscovered secret door. Open
  doors and revealed, opened secret doors let the party through. A blocked move keeps the token picked up.
  Locked doors cannot be opened from the players' side. The DM still places tokens anywhere.
- DM secrets stay secret: info cards on the players' side use a player-facing name (`playerLabel`) and
  description, never the DM label. DM cards tag notes "DM only" and show what players will call the thing.

## M1.6 Details, openables, UI hygiene — 2026-09-30

- Death House details from the module: purpose-built props replace placeholders (mounted longsword,
  crossbow rack, desk key, jewelry box, tiger-skin rug, swaddled bundle, crystal orb); new pieces for table
  settings, pantry stores, hanging cookware and the dumbwaiter bell, linens, sheeted storage shapes, a
  bricked-up window, a rolling ladder, and old footprints across the dungeon (none over the hidden pit).
- Every room has a player description and a DM-only note (original wording), shown in a room card.
- Openables: every chest, trunk, footlocker, cabinet, wardrobe, coffin, desk, nightstand and jewelry box
  opens (lids lift, doors swing, drawers slide). Contents are mapped from the module; locked ones need the
  DM; opening reveals hidden contents (the den's crossbows, the library key, the jewelry box).
- Hover tooltips name what is under the mouse. A new location clears the old one's labels. Search opens
  from a button and the top bar lays out in rows without overlapping.

## M1.7 Real-world proportions — 2026-09-30

- Measured every kit piece in feet against real sizes. Humanoids are now ~6 ft tall with ~1.4-ft shoulders
  and a human-sized head (they were 3+ ft wide). Tables take a real size per use at 2.5 ft high (the den's
  side table 3 × 2, card table 4 × 4, dining 10 × 4.5, parlor 3 × 3). Base rings draw at ~60% of the
  square. Result: rooms read at true scale with floor to move across.
- Camera: 40° lens (was a telephoto 30°) with distances matched so things keep their on-screen size, and a
  slightly more oblique tabletop angle for natural depth.
- Grid test: the players'-end, full-wall tabletop case needs fewer visible grid pixels (walls hide most of
  the one revealed room); the no-leak check is unchanged.

## M2.0 World map — 2026-09-30

- `locations/ch02/barovia-region/world.json` (generated by `scripts/authoring/barovia-world.py`): the 26
  lettered locations of the regional map with positions measured at one quarter-mile hex ≈ 17.6 px, plus
  roads, rivers, lakes, peaks, high ground and woods. Only positions and names; the map art is original.
  Yester Hill sits off the printed crop and is placed approximately.
- World map view (map button beside the library): pan and zoom, lettered pins (minor names on hover), a
  party marker linked to campaign state. The DM drags the party to a pin or into the wilderness; the card
  gives straight-line miles and travel time at slow / normal / fast pace, and opens the built battle maps at
  that pin (Village of Barovia: village, church, Death House; Tser Pool; the Svalich Woods road). Opening a
  location moves the marker to its pin; a trail of recent moves is kept.

## M2.1 Outdoors — 2026-09-30

- Distant scenery for outdoor locations (`render/backdrop.ts`): the land runs on past the map edge, a
  forest ring closes in, ridges rise where the world map has high ground in that direction, the named
  peaks stand snow-capped at their bearings, and Castle Ravenloft crowns its pillar of rock where the
  world map puts it. Outdoor camera may tilt lower toward the horizon; fog is thinner outdoors.
- Village of Barovia remapped from the book map (p.42, one square = 40 ft): 116 building footprints
  measured from the roof shapes at 200 dpi (`scripts/authoring/village-map.py`), E1–E7 squares placed on
  their markers, the seed's roads and props carried into the measured frame. Houses are now gabled
  timber-framed Barovian houses with shutters and chimneys, varied per house.
- Placement layers say so in the subtitle ("40-ft placement squares") and frame an area with its
  neighbourhood.

## M2.2 Initiative and tactical ranges — 2026-09-30

- Roster of character sheets (name, colour, speed, reach, range, darkvision, initiative modifier; PC or foe),
  edited in the Initiative sheet and saved with the campaign. Tick who is in, roll or type initiative, start.
- An encounter gives every combatant its own token (coloured base, name label) placed around the party
  marker; ending it folds them back into one party marker.
- On each turn a Fire-Emblem-style overlay shows green squares the combatant can still move to (5e grid
  movement with the chosen diagonal rule, no corner cutting, closed doors and other creatures block), red
  squares it could strike in melee from anywhere it can reach, and a paler red for ranged reach with a clear
  line. Moving onto a green square spends that movement; the players' side may not move outside it or on
  someone else's turn. The DM may place a token anywhere (no movement spent). `core/range.ts` is unit-tested.
- Turn bar with the order, round, movement left, Next (or N) / previous / End; shown on the Player Display too.

## M2.3 Campaigns — 2026-09-30

- Campaign registry (`manifests/campaigns.json`, `app/src/campaigns.ts`): each campaign has its own manifest,
  world map and saved state; the library's top row switches between them and opening a location switches to
  its campaign, saving the previous one. See `docs/CAMPAIGNS.md`.
- A Wild Sheep Chase (Winghorn Press) imported from a `tabletop-mapset 1.0` export with
  `scripts/authoring/import-mapset.py`: the tavern (two floors), the street, the main road, the side path and
  Noke's tower (four platforms at 0/10/20/30 ft with stair runs and vertical links). Floors → rooms and terrain,
  walls clipped by their openings with door and window flags, posts → oaks and timber posts, raised patches →
  prisms (undergrowth noted as difficult terrain), the stream → water, decals → terrain. The export's DM notes
  ride along as room notes; pointer sections show in the library as "uses …". Regional hex map → world map
  with the route's five stops as pins.
- New kit pieces: `stairs-run` (any bearing), `prism` (polygon-shaped block), `oak`, `post-round`. World-map
  terrain density scales with the map; one label per named tract; the outdoor ground apron is a full disc.

## M2.4 Sheep Chase town, painted world maps, themes — 2026-09-30

- The tavern (`scripts/authoring/wsc-town.py`, shared helpers in `authorlib.py`): a 60 × 50 ft inn with a
  round table for six under the chandelier, the bar along the north side under a mezzanine with casks racked
  in the wall, an innkeeper's office with a strongbox, kitchen and store, stairs to a gallery, a railed landing
  and three inn rooms; a yard with a well and cart, and stables with three stalls and two horses.
- The town square replaces the street: a cobbled square around the well for a town of fifty, the tavern
  (same footprint, front door in the same place), a temple with a bell tower, the town hall, a dozen houses,
  the stables; Guz, his wolves and the bear placed for the DM. New kit: cask rack, hay, trough, round table,
  bar top, temple, sheep.
- Campaign themes: A Wild Sheep Chase is pastoral (light sky, green ground, thin fog, bright daylight);
  Curse of Strahd stays gothic. Backdrops, page gradient, fog and lights follow the theme.
- Noke's tower is a stacked site: every platform below the current one stays visible so the treehouse reads
  as one, framing takes the whole site, and its backdrop is a deeper wooded valley with taller ridges.
- World maps are painted: textured ground, forests of tree symbols with shadows, shaded hills and snow-capped
  mountains, lakes with banks and ripples, cased roads and dashed paths, town, castle, camp and ruin
  symbols, serif place names, a key panel listing every place (click to centre), a hex grid at the map's own
  scale (¼ mile in Barovia, 1 mile round the town), a scale bar that follows the zoom, and a compass.
- Camera: more glide (lower damping), gentler zoom steps, and a zoom-out limit that grows with the map.

## M2.5 Distant sites at true scale, real creature sizes, the section slicer — 2026-09-30

- Every outdoor map shows the other mapped places in the distance at their real distance and bearing from
  the world map (miles × 5280 ft), as silhouettes only: settlements, camps, castles, towers, temples, ruins
  and Tser Falls (a 1,000-ft cliff, white water, the stone arch bridge, mist and the river below), with the
  near ridges opened toward mapped neighbours and haze thickening with distance. Castle Ravenloft is only
  named at K.
- Creatures are modelled at real size; the size category sets the base ring, not the model. Horses stand
  about 5½ ft at the shoulder, the bear and the ape are new, the humanoids keep real proportions.
- Small buildings (the tavern, Death House) are stacked sites: every floor renders at once and the Section
  slider beside the floor tabs cuts the building at any height, up through the roof or down into the cellar.
  The cut follows the floor you pick (5 ft up with low walls, just under the ceiling with full walls) until
  you move it; the arrow button snaps it back. Only the current floor is annotated. A house and the dungeon
  under its garden are separate stacks; open sites (Noke's tower) keep the cut above the top platform so the
  whole tower stays in view.
- Facades: houses have timber frames, gabled roofs with chimneys, shutters and sills; the tavern on the
  square is the same building seen from outside.
- Wall tops stop a hair under the ceiling so they never fight the floor slab above them.

## M2.6 Castle Ravenloft, world-map places, roads — 2026-10-01

- Castle Ravenloft (`locations/ch04/K`, `scripts/authoring/castle-ravenloft.py`): a reconstruction of the
  whole castle from the book's isometric plates. Each plate is rectified into plan view (the two grid
  directions measured, the squares warped square) and the rooms read off a labelled grid, then placed in one
  frame registered on the towers. Twelve levels: dungeon and catacombs (-80, the 40 crypts and the tombs),
  the larders (-40), courtyard and main floor, the grand landing (+30), the court of the count (+50), the
  rooms of weeping (+90), the spires (+130), the witches' floor of the south tower (+150), the tower roofs
  and the bridge (+190), the north tower peak and roof (+240/+250) and the high tower peak (+300). Every
  keyed area K1–K88 with the dungeon cells, the stair towers rising through every floor, the elevator
  shaft, secret doors, own-wording descriptions and DM notes, and stair links between the floors. The
  castle is a stacked site: lift the section above the high tower and the whole castle stands.
- A keyed area split into several rooms uses `KEY-part`; a scene can be `partial` while it is built; a scene
  can name its `entry` level; the level that meets the open air decides the fog and the backdrop.
- Labels thin out with distance: far out only the area keys remain.
- World map: every place carries a player blurb and a DM note; hovering shows them; a tap on a place with a
  map opens it; the DM reveals places to the players (the players' map shows only known places).
- Roads and rivers from the world map run in and out of every outdoor map at true scale, joined to the
  map's own road at its edge, with gaps in the forest and the ridges along them.
- The section slider snaps to each floor's default cut.

## M2.7 Creatures on the map, free movement — 2026-10-01

- The creature repository (paw button): every person, monster and beast the module names, from the
  characters manifest, searchable by name, kind and area. Place one beside the party or place by tap, as many
  as you like. Each gets a figure (the characterised humanoid from the manifest, or the kit beast), a base
  ring by size, a players' name (people appear as strangers until the DM names them), hit points for the
  open-content monsters, and starts hidden from the players.
- Tap a placed creature: the panel shows what players see (rename it), hit points, Reveal/Hide, the Reach
  helper, Initiative and Remove. Players who tap a revealed creature get its name and what they make of it.
- The DM moves any creature or combatant anywhere at any time; players move only the party and only where
  it can walk. The Reach helper draws the picked-up token's move and strike squares outside initiative; in
  initiative the current combatant's ranges show as before. Placed creatures join the initiative with their
  own tokens from the roster sheet.
- Castle Ravenloft stands on its crag in the valley views, in full, with lit windows; from the castle the
  valley lies a thousand feet below.

## M2.8 Vallaki — 2026-10-01

- The Town of Vallaki (`locations/ch05/N`): a placement map from the book's town plan (scale bar), the palisade with
  gates where the roads cross it, the streets, 186 houses from the map's roof blobs, and the keyed sites N1–N9.
  Tap a keyed building for "Enter …"; the back button returns to the town.
- Every site as its own map (`scripts/authoring/vallaki-sites.py`): the Blue Water Inn (three floors: stable and
  loft, taproom under its balconies, kitchen, the hidden hall, guest rooms, the wereravens' attic), the
  Burgomaster's Mansion (foyer and gallery, library, the locked closet, the spirit mirror, Victor's attic
  workroom), Wachterhaus (the bay den and library, Stella's room, Nikolai in his bed, the cellar and the cult's
  pentagram), the Coffin Maker's Shop (thirteen coffins, the nest of crates upstairs), the Vistani Camp (the
  hill, the tent, the ring of wagons, the dusk elf hovels), and, from their text alone, St. Andral's Church
  (the village church's plan without the undercroft), Blinsky Toys and the Arasek Stockyard with Rictavio's wagon.
  Every keyed area with furniture, people, secret doors, lights, descriptions and DM notes.
- The section cut only slices the shell (floors, walls, doors, roofs). Furniture, people and things are never
  cut through: they show whole until the cut drops below their floor. The follow cut sits just under the floor
  above (the roof, on the top storey), so each room shows entire.
- A blowout without a world pin of its own takes its parent's for the backdrop.

## M2.9 The map, the frame and the measure — 2026-10-01

- A measure tool: two taps lay a ruler with the distance in feet and squares.
- Every map carries a north arrow that turns with the camera and a scale bar that follows the zoom, in the
  bottom-right corner.
- The Lands of Barovia read off the printed regional map at 400 dpi (`scripts/authoring/barovia-cover.py`):
  every lettered site (the Mount Baratok markers and the Ivlis bridges included), the roads and dotted
  trails, the three rivers, the lakes in their true shapes, and a land-cover grid at an eighth of a mile
  (forest, hills, mountains, water, mist) that the world map is painted from. Names lettered where the
  page letters them.
