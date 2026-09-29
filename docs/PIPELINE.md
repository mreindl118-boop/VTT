# Asset pipeline

## From book to data

1. `reference/curse-of-strahd.pdf` (gitignored).
2. `npm run ocr` → `reference/ocr/page-NNN.txt` (pdftoppm 300 DPI → tesseract).
3. `node --experimental-strip-types scripts/manifest-report.ts` cross-checks every key/name in
   `manifests/*.json` against the OCR and prints **mismatches to flag** (never auto-renames).
4. Author `locations/<chapter>/<location>/scene.json` + `grid.json` from the book's layout (measured in
   book squares, converted with `bookSquaresToCells`). Only keys, names, page numbers, dimensions.

## Data files per location

```
locations/<chapter>/<location>/
  scene.json   levels, rooms (area key, polygon, page), walls (Foundry-style flags), doors, lights,
               objects with visibility classes, spawns, vertical links
  grid.json    per level: floor polygons (grid clip mask), grid type, hex orientation, origin, style
  map.glb      (optional) kit instances + unique meshes, meters, meshopt-compressed
```

Schema: `app/src/core/schema.ts`. Validated in `tests/scenes.test.ts` (and every scene key must exist in
`manifests/locations.json` and vice versa for built locations).

## Kit

`app/src/kit/` builds kit pieces procedurally (walls, floors, doors, stairs, props) in feet with palette
materials. `scripts/export-kit.ts` (M1) will run them through `GLTFExporter` → `kits/*.glb` in meters with
meshopt, so authored locations can mix procedural kit instances and hand-made GLBs.

## Budgets per loaded map

≤ 300k triangles · ≤ 100 draw calls after instancing · ≤ 32 MB textures · cold load < 3 s from cache.
`renderer.info` is surfaced in the DM debug HUD (`?hud=1`).
