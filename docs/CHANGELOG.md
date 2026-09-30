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
