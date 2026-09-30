# mistLAB

A browser-first, iPad-first 3D tabletop PWA for running *Curse of Strahd*: original low-poly battle maps
organized exactly like the book (chapter → location → area key), one DM/Player view slider on every view,
and a Player Display window pinned to the players' view.

No book text, art or map images are stored here: only keys, names, page numbers, dimensions and the DM's
own notes. All geometry is original.

```sh
npm install
npm run dev              # http://localhost:5173 (use your LAN IP on the iPad)
npm test                 # unit tests (Vitest)
npm run test:e2e         # acceptance tests (Playwright: build + preview + Chromium)
npm run ocr              # OCR reference/module/curse-of-strahd.pdf into reference/ocr (gitignored)
node --experimental-strip-types scripts/manifest-report.ts   # flag manifest vs book mismatches
```

URL options: `?scene=dev/m0-test-room`, `?display=player` (Player Display), `?hud=1` (tris/calls/fps).

## Using it

- **Slider** (right edge): drag between *Players* (0) and *DM* (1). Hold the eye to peek at 1. Keys `[` `]`, hold `\`.
- **Tokens**: drag to move; the pill shows distance in feet.
- **Reveal tools** (top right): tap a room, hidden object or secret door to reveal or hide it for players;
  paint reveal/fog brushes; undo. Tap a door to open or close it.
- **Player Display**: the monitor button opens a second window for the table display.

## Layout

```
app/          PWA (src/core = pure logic, src/render = three.js, src/kit = procedural kit, src/ui, src/state)
kits/         exported GLB kit pieces (meters)
locations/    <chapter>/<location>/{scene.json,grid.json,map.glb}
manifests/    locations.json · characters.json · encounters.json
reference/    gitignored: the PDF, OCR text, notes
docs/         UNITS · SLIDER · STYLE · PIPELINE · CHANGELOG
tests/ e2e/   Vitest + Playwright
```

Milestones are listed in `docs/CHANGELOG.md`; M0 Foundations is done.
