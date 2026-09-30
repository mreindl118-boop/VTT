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
