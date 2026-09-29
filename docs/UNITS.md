# Units and scale

| Thing | Value |
|---|---|
| Engine world unit | **1 foot** |
| Grid cell | **5 ft** (`CELL_FT`) |
| Tabletop scale | 1 cell = 1 in; a Medium base is 1 in (25 mm) |
| GLB files | **meters**, per glTF 2.0. Converted on load by `FT_PER_M = 1 / 0.3048` |
| Axes | +X east, +Z south, +Y up. Map "north" is −Z. Plan coordinates in JSON are `[x, z]` in feet. |
| Fog / explored bitmap | 1 ft per texel, per level |

All conversions live in `app/src/core/units.ts`; `tests/units.test.ts` enforces them. Nothing else in the
codebase may hard-code `0.3048`, `5`-ft cells or base-ring sizes.

## Book scales

| Book map | Conversion |
|---|---|
| 5-ft maps | 1 book square = 1 cell |
| 10-ft maps (Castle Ravenloft, Argynvostholt, Abbey, Tsolenka, Amber Temple, Vistani Camp, Werewolf Den) | 1 book square = 2 × 2 cells (`bookSquaresToCells(n, 10)`) |
| Town maps (Barovia 40 ft, Krezk 50 ft, Yester Hill 50 ft, Berez 100 ft, Vallaki scale bar) | placement layers only; battle insets are built for keyed buildings |
| Regional map | 1 hex = ¼ mile = 1,320 ft, pointy-top |

## Creature footprints (PHB space, DMG squares/hexes)

| Size | Space | Squares | Hexes | Base ring |
|---|---|---|---|---|
| Tiny | 2½ ft | ¼ cell | ¼ hex | 0.5 in |
| Small | 5 ft | 1 | 1 | 1 in |
| Medium | 5 ft | 1 | 1 | 1 in |
| Large | 10 ft | 2 × 2 | 3 | 2 in |
| Huge | 15 ft | 3 × 3 | 7 | 3 in |
| Gargantuan | 20 ft+ | 4 × 4 | 12 | 4 in |

Base ring diameter in feet = inches × 5 (one inch of table = one 5-ft cell).

## Movement

- Default: every square is 5 ft, diagonals included (PHB).
- Variant (setting): 5-10-5 diagonals (DMG).
- Hexes: every hex is 5 ft.
- Difficult terrain is a floor-material flag; each cell entered costs double.

## Default heights

Interior ceiling 10 ft unless the book says otherwise. Ravenloft K1 courtyard walls 90 ft. K18a High Tower
shaft spans the full castle height (from Map 1 once OCR'd).
