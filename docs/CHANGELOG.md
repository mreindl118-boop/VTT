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
